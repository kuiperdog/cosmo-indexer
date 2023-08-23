import { Entity, TypeormDatabase } from '@subsquid/typeorm-store'
import { Collection, Objekt, Transfer} from './model'
import { events as objektEvents } from './abi/Objekt'
import { processor } from './processor'
import axios, { AxiosResponse } from 'axios'
require = require('esm')(module)
import { registerInterceptor } from 'axios-cached-dns-resolve'

const client = axios.create({
    validateStatus: () => { return true }
})
registerInterceptor(client)
const MAX_REQUESTS = 100

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    const entities: { [key: string]: Entity[] } = {
        [Collection.name]: [],
        [Objekt.name]: [],
        [Transfer.name]: []
    }
    
    for (let block of ctx.blocks) {
        for (let log of block.logs) {
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
                    let objekt = entities[Objekt.name].find(i => i.id === token) as Objekt
                    if (objekt)
                        objekt.transfers.push(transfer)
                    else
                        entities[Objekt.name].push(new Objekt({id: token, transfers: [transfer]}))
                }
                entities[Transfer.name].push(transfer)
            }
        }
    }

    let objekts: Objekt[] = []
    let requests: AxiosResponse[] = []
    for (let i = 0; i < entities[Objekt.name].length; i += MAX_REQUESTS) {
        ctx.log.info('Fetching data for ' + Math.min(MAX_REQUESTS, entities[Objekt.name].length - i) + ' Objekts')
        requests.push(...await Promise.all(entities[Objekt.name].slice(i, i + MAX_REQUESTS).map(objekt => {
            return client.get('https://api.cosmo.fans/objekt/v1/token/' + objekt.id)
        })))
    }
    for (let i = 0; i < requests.length; i++) {
        if (requests[i].status === 404 || !requests[i].data || !requests[i].data.objekt) {
            ctx.log.warn('Failed to fetch metadata for Objekt ' + entities[Objekt.name][i].id)
            continue
        }

        const entry = entities[Objekt.name][i] as Objekt
        const metadata = requests[i].data.objekt

        const collectionId = metadata.collectionId.toLowerCase().replaceAll(' ', '-')
        let collection = await ctx.store.get(Collection, collectionId)
        if (!collection)
            collection = entities[Collection.name].find(e => e.id === collectionId) as Collection
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
                objekts: []
            })
            entities[Collection.name].push(collection)
        }

        const objekt = new Objekt({
            id: entry.id,
            collection: collection,
            serial: metadata.objektNo,
            transfers: []
        })

        entry.transfers.forEach((transfer => {
            const transferIndex = entities[Transfer.name].findIndex(t => t.id === transfer.id)
            if (transferIndex !== -1)
                (entities[Transfer.name][transferIndex] as Transfer).objekt = objekt
        }))
        objekts.push(objekt)
    }
    entities[Objekt.name] = objekts

    for (const key of Object.keys(entities)) {
        const entries = entities[key]
        if (entries.length > 0) {
            await ctx.store.save(entries)
            ctx.log.info('Saved ' + entries.length + ' entities of type ' + key)
        }
    }
})
