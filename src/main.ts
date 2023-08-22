import { Entity, EntityClass, TypeormDatabase } from '@subsquid/typeorm-store'
import { Collection, Objekt, Transfer} from './model'
import { events as objektEvents } from './abi/Objekt'
import { Context, Log, processor } from './processor'
import axios from 'axios'

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    const entities: Map<string, Entity[]> = new Map();
    
    for (let block of ctx.blocks) {
        for (let log of block.logs) {
            if (log.topics[0] === objektEvents.Transfer.topic) {
                await handleTransfer(ctx, log, entities)
            }
        }
    }

    // Entities must be saved in hierarchical order to avoid referencing a nonexistent relation
    const saveOrder = ["Collection", "Objekt", "Transfer"]

    for (const key of saveOrder) {
        const entries = entities.get(key)
        if (entries) {
            await ctx.store.save(entries)
            ctx.log.info('Saved ' + entries.length + ' entities of type ' + key)
        }
    }
})

async function handleTransfer(ctx: Context, log: Log, entities: Map<string, Entity[]>) {
    ctx.log.info("Processing on block " + log.block.height)
    const event = objektEvents.Transfer.decode(log)

    let objekt = await getEntity(Objekt, event.tokenId.toString(), ctx, entities);
    if (!objekt) {
        ctx.log.info('Fetching metadata for token ' + event.tokenId.toString())
        const res = await axios.get('https://api.cosmo.fans/objekt/v1/token/' + event.tokenId.toString())
        if (!res || !res.data || !res.data.objekt) {
            ctx.log.error('Failed fetching metadata for token ' + event.tokenId.toString())
            return
        }
        const metadata = res.data.objekt
        const collectionId = metadata.collectionId.toLowerCase().replaceAll(' ', '-')

        let collection = await getEntity(Collection, collectionId, ctx, entities);
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
            pushEntity(Collection.name, collection, entities)
            ctx.log.info("Saved collection " + collection.id)
        }

        objekt = new Objekt({
            id: event.tokenId.toString(),
            collection: collection as Collection,
            serial: metadata.objektNo,
            transfers: []
        })
        pushEntity(Objekt.name, objekt, entities)
        ctx.log.info("Saved Objekt " + objekt.id)
    }

    pushEntity(Transfer.name, new Transfer({
        id: log.id,
        objekt: objekt as Objekt,
        from: event.from,
        to: event.to,
        timestamp: BigInt(log.block.timestamp)
    }), entities)
    ctx.log.info("Saved transfer " + log.id)
}

async function getEntity<E extends Entity>(entityClass: EntityClass<E>, id: string, ctx: Context, map: Map<string, Entity[]>): Promise<Entity | undefined> {
    if (map.get(entityClass.name)) {
        const value = map.get(entityClass.name)?.find((i) => i.id === id)
        if (value)
            return value
    }
    return await ctx.store.get(entityClass, id)
}

function pushEntity(type: string, value: Entity, map: Map<string, Entity[]>) {
    if (map.get(type))
        map.get(type)?.push(value)
    else
        map.set(type, [value])
}
