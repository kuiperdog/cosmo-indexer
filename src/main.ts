import { TypeormDatabase } from '@subsquid/typeorm-store'
import { Collection, Objekt, Transfer, Vote } from './model'
import { events as objektEvents } from './abi/Objekt'
import { events as governorEvents } from './abi/Governor'
import { contracts, processor } from './processor'
import axios, { AxiosResponse } from 'axios'
require = require('esm')(module)
import { registerInterceptor } from 'axios-cached-dns-resolve'

const client = axios.create({
    validateStatus: () => { return true }
})
registerInterceptor(client)
const MAX_REQUESTS = 500

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    const transfers: Transfer[] = []
    const objekts: Objekt[] = []
    const votes: Vote[] = []

    for (let block of ctx.blocks) {
        for (let log of block.logs) {
            if (!contracts.includes(log.address))
                continue
            
            if (log.topics[0] === objektEvents.Transfer.topic) {
                const event = objektEvents.Transfer.decode(log)
                const token = event.tokenId.toString()
                const transfer = new Transfer({
                    id: log.id,
                    objekt: await ctx.store.get(Objekt, token),
                    to: event.to,
                    from: event.from,
                    timestamp: BigInt(log.block.timestamp)
                })
                if (!transfer.objekt) {
                    let objekt = objekts.find(i => i.id === token) as Objekt
                    if (objekt)
                        objekt.transfers.push(transfer)
                    else
                        objekts.push(new Objekt({id: token, transfers: [transfer]}))
                }
                transfers.push(transfer)
            } else if (log.topics[0] === governorEvents.Voted.topic) {
                const event = governorEvents.Voted.decode(log)
                votes.push(new Vote({
                    id: log.id,
                    contract: log.address,
                    poll: event.pollId,
                    amount: event.comoAmount,
                    from: event.voter,
                    timestamp: BigInt(log.block.timestamp)
                }))
            }
        }
    }

    for (let i = 0; i < objekts.length; i += MAX_REQUESTS) {
        const batch: Objekt[] = objekts.slice(i, i + MAX_REQUESTS)
        const collections: Collection[] = []
        const newObjekts: Objekt[] = []

        const requests: AxiosResponse[] = []
        requests.push(...await Promise.all(batch.map(objekt => {
            return client.get('https://api.cosmo.fans/objekt/v1/token/' + objekt.id)
        })))
        for (let i = 0; i < requests.length; i++) {
            if (requests[i].status === 404 || !requests[i].data || !requests[i].data.objekt) {
                ctx.log.warn('Failed to fetch metadata for Objekt ' + batch[i].id)
                continue
            }

            const metadata = requests[i].data.objekt
            const collectionId = metadata.collectionId.toLowerCase().replaceAll(' ', '-')

            let collection = await ctx.store.get(Collection, collectionId)
            if (!collection)
                collection = collections.find(e => e.id === collectionId)
            if (!collection) {
                collection = new Collection({
                    id: collectionId,
                    thumbnail: metadata.thumbnailImage,
                    front: metadata.frontImage,
                    back: metadata.backImage,
                    artists: metadata.artists,
                    class: metadata.class,
                    member: metadata.member,
                    season: metadata.season,
                    number: metadata.collectionNo,
                    textColor: metadata.textColor,
                    timestamp: batch[i].transfers[0].timestamp,
                    objekts: []
                })
                collections.push(collection)
            }

            const objekt = new Objekt({
                id: batch[i].id,
                collection: collection,
                serial: metadata.objektNo,
                transfers: []
            })

            batch[i].transfers.forEach((transfer => {
                const transferIndex = transfers.findIndex(t => t.id === transfer.id)
                if (transferIndex !== -1)
                    transfers[transferIndex].objekt = objekt
            }))
            newObjekts.push(objekt)
        }

        if (collections.length > 0) {
            await ctx.store.save(collections)
            ctx.log.info('Saved collections: ' + collections.length)
        }
        if (newObjekts.length > 0) {
            await ctx.store.save(newObjekts)
            ctx.log.info('Saved Objekts: ' + newObjekts.length)
        }
    }

    if (transfers.length > 0) {
        await ctx.store.save(transfers)
        ctx.log.info('Saved transfers: ' + transfers.length)
    }

    if (votes.length > 0) {
        await ctx.store.save(votes)
        ctx.log.info('Saved votes: ' + votes.length)
    }
})
