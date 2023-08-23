import { Entity, TypeormDatabase } from '@subsquid/typeorm-store'
import { Collection, Objekt, Transfer} from './model'
import { events as objektEvents } from './abi/Objekt'
import { processor } from './processor'
import axios from 'axios'

axios.defaults.validateStatus = () => { return true }

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
    const requests = await Promise.all(entities[Objekt.name].map(objekt => {
        return axios.get('https://api.cosmo.fans/objekt/v1/token/' + objekt.id)
    }))
    for (var i = 0; i < requests.length; i++) {
        if (requests[i].status === 404 || !requests[i].data || requests[i].data.error) {
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
