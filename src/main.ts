import { TypeormDatabase } from '@subsquid/typeorm-store'
import { Collection, Objekt, Transfer} from './model'
import { events as objektEvents } from './abi/Objekt'
import { Context, Log, processor } from './processor'
import axios from 'axios'

processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
    for (let block of ctx.blocks) {
        for (let log of block.logs) {
            if (log.topics[0] === objektEvents.Transfer.topic) {
                await handleTransfer(ctx, log)
            }
        }
    }
})

async function handleTransfer(ctx: Context, log: Log) {
    ctx.log.info("Processing on block " + log.block.height)
    const event = objektEvents.Transfer.decode(log)

    let objekt = await ctx.store.get(Objekt, event.tokenId.toString());
    if (!objekt) {
        const res = await axios.get('https://api.cosmo.fans/objekt/v1/token/' + event.tokenId.toString())
        if (!res || !res.data || !res.data.objekt) {
            ctx.log.error('Failed fetching metadata for token ' + event.tokenId.toString())
            return
        }
        const metadata = res.data.objekt
        const collectionId = metadata.collectionId.toLowerCase().replaceAll(' ', '-')

        let collection = await ctx.store.get(Collection, collectionId)
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
            await ctx.store.save(collection)
            ctx.log.info("Saved collection " + collection.id)
        }

        objekt = new Objekt({
            id: event.tokenId.toString(),
            collection: collection,
            serial: metadata.objektNo,
            transfers: []
        })
        await ctx.store.save(objekt)
        ctx.log.info("Saved Objekt " + objekt.id)
    }

    await ctx.store.save(new Transfer({
        id: log.id,
        objekt: objekt,
        from: event.from,
        to: event.to,
        timestamp: BigInt(log.block.timestamp)
    }))
    ctx.log.info("Saved transfer " + log.id)
}
