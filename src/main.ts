import { Entity, Store, TypeormDatabase } from '@subsquid/typeorm-store'
import { Logger } from '@subsquid/logger'
import { processor, getContracts, Transaction, Log } from './processor'
import { Collection, Objekt, Transfer, Vote, Como } from './model'
import * as objektContract from './abi/Objekt'
import * as governorContract from './abi/Governor'
import * as comoContract from './abi/ERC20'
import axios, { AxiosResponse } from 'axios'
import axiosRetry from 'axios-retry'

const client = axios.create({
    validateStatus: () => { return true }
})
axiosRetry(client)

const MAX_REQUESTS = 500
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

getContracts(processor)
    .then(contracts => {
        processor.run(new TypeormDatabase({supportHotBlocks: true}), async (ctx) => {
            const entities = new Map<string, Entity[]>()

            for (let block of ctx.blocks) {
                for (let log of block.logs) {
                    switch (log.topics[0]) {
                        case objektContract.events.Transfer.topic:
                            if (contracts.Objekt.includes(log.address))
                                await processObjektTransfer(log, entities, ctx.store)
                            break
                        case governorContract.events.Voted.topic:
                            if (contracts.Governor.includes(log.address))
                                await processVote(log, entities)
                            break
                        case comoContract.events.Transfer.topic:
                            if (contracts.Como.includes(log.address))
                                await processComoTransfer(log, entities, ctx.store)
                            break
                        default:
                            break
                    }
                }

                for (let transaction of block.transactions) {
                    switch (transaction.sighash) {
                        case objektContract.functions.batchUpdateObjektTransferrability.sighash:
                            if (contracts.Objekt.includes(transaction.to))
                                await processTransferabilityUpdate(transaction, entities, ctx.store)
                            break
                        case governorContract.functions.reveal.sighash:
                            if (contracts.Governor.includes(transaction.to))
                                await processReveal(transaction, entities, ctx.store)
                            break
                        default:
                            break
                    }
                }
            }

            await populateData(entities, ctx.store, ctx.log)

            const hierarchy = [ Collection.name, Objekt.name, Transfer.name ]
            for (let key of new Set([ ...hierarchy, ...entities.keys() ])) {
                if (!entities.has(key) || !entities.get(key)!.length)
                    continue

                const data = entities.get(key)!
                await ctx.store.save(data)

                if (data.length > 1)
                    ctx.log.info(`Saved ${data.length} entities of type "${key}"`)
                else
                    ctx.log.info(`Saved 1 ${key} entity with ID "${data[0].id}"`)
            }
        })
    })

async function processObjektTransfer(log: Log, data: Map<string, Entity[]>, store: Store) {
    const event = objektContract.events.Transfer.decode(log)
    const token = event.tokenId.toString()

    if (!data.has(Objekt.name))
        data.set(Objekt.name, [])

    const objekt = data.get(Objekt.name)?.find(i => i.id === token) as Objekt
        || await store.get(Objekt, token)
        || new Objekt({ id: token })

    objekt.owner = event.to
    
    const savedIndex = data.get(Objekt.name)?.findIndex(i => i.id === token)!
    if (savedIndex > -1)
        (data.get(Objekt.name)![savedIndex] as Objekt).owner = objekt.owner
    else
        data.get(Objekt.name)?.push(objekt)

    const transfer = new Transfer({
        id: log.id,
        objekt: objekt as Objekt,
        to: event.to,
        from: event.from,
        timestamp: BigInt(log.block.timestamp)
    })

    if (data.has(Transfer.name))
        data.get(Transfer.name)?.push(transfer)
    else
        data.set(Transfer.name, [transfer])
}

async function processVote(log: Log, data: Map<string, Entity[]>) {
    const event = governorContract.events.Voted.decode(log)

    const vote = new Vote({
        id: log.id,
        from: event.voter,
        contract: log.address,
        poll: event.pollId,
        index: event.voteIndex,
        amount: event.comoAmount,
        timestamp: BigInt(log.block.timestamp)
    })

    if (data.has(Vote.name))
        data.get(Vote.name)?.push(vote)
    else
        data.set(Vote.name, [vote])
}

async function processComoTransfer(log: Log, data: Map<string, Entity[]>, store: Store) {
    const event = comoContract.events.Transfer.decode(log)

    if (!data.has(Como.name))
        data.set(Como.name, [])
    
    if (event.from !== NULL_ADDRESS) {
        let entry = data.get(Como.name)?.find(c => (c as Como).contract === log.address && (c as Como).owner === event.from)

        if (entry) {
            (entry as Como).balance = BigInt(Math.min(0, Number((entry as Como).balance - event.value)))
        } else {
            entry = await store.findOneBy(Como, { contract: log.address, owner: event.from })

            if (entry) {
                (entry as Como).balance = BigInt(Math.min(0, Number((entry as Como).balance - event.value)))
                data.get(Como.name)?.push(entry)
            } else { 
                data.get(Como.name)?.push(new Como({
                    id: log.id,
                    contract: log.address,
                    owner: event.from,
                    balance: BigInt(0)
                }))
            }
        }
    }

    if (event.to !== NULL_ADDRESS) {
        let entry = data.get(Como.name)?.find(c => (c as Como).contract === log.address && (c as Como).owner === event.to)

        if (entry) {
            (entry as Como).balance = (entry as Como).balance + event.value
        } else {
            entry = await store.findOneBy(Como, { contract: log.address, owner: event.to })

            if (entry) {
                (entry as Como).balance = (entry as Como).balance + event.value
                data.get(Como.name)?.push(entry)
            } else { 
                data.get(Como.name)?.push(new Como({
                    id: log.id,
                    contract: log.address,
                    owner: event.to,
                    balance: event.value
                }))
            }
        }
    }
}

async function processTransferabilityUpdate(txn: Transaction, data: Map<string, Entity[]>, store: Store) {
    const method = objektContract.functions.batchUpdateObjektTransferrability.decode(txn.input)

    if (!data.has(Objekt.name))
        data.set(Objekt.name, [])
    
    for (let token of method.tokenIds) {
        let objekt = data.get(Objekt.name)?.find(o => o.id === Number(token).toString())
        if (objekt) {
            (objekt as Objekt).transferrable = method.transferrable
        } else {
            objekt = await store.get(Objekt, Number(token).toString())
            if (objekt) {
                (objekt as Objekt).transferrable = method.transferrable
                data.get(Objekt.name)?.push(objekt)
            }
        }
    }
}

async function processReveal(txn: Transaction, data: Map<string, Entity[]>, store: Store) {
    const method = governorContract.functions.reveal.decode(txn.input)

    if (!data.has(Vote.name))
        data.set(Vote.name, [])

    for (let i = 0; i < method.data.length; i++) {
        let vote = data.get(Vote.name)?.find(v =>
            (v as Vote).contract === txn.to &&
            (v as Vote).index === method.offset + BigInt(i) &&
            (v as Vote).poll === method.pollId
        )

        if (vote) {
            (vote as Vote).candidate = Number(method.data[i].votedCandidateId)
        } else {
            vote = await store.findOneBy(Vote, {
                contract: txn.to,
                index: method.offset + BigInt(i),
                poll: method.pollId
            })
            if (vote) {
                (vote as Vote).candidate = Number(method.data[i].votedCandidateId)
                data.get(Vote.name)?.push(vote)
            }
        }
    }
}

async function populateData(data: Map<string, Entity[]>, store: Store, logger: Logger) {
    if (!data.has(Objekt.name))
        return

    const unpopulated = data.get(Objekt.name)?.filter(o => !(o as Objekt).collection)

    for (let i = 0; i < unpopulated!.length; i += MAX_REQUESTS) {
        const batch = unpopulated!.slice(i, i + MAX_REQUESTS)

        const requests: AxiosResponse[] = []
        requests.push(...await Promise.all(batch.map(o => {
            return client.get(`https://api.cosmo.fans/objekt/v1/token/${o.id}`)
        })))

        for (let i = 0; i < requests.length; i++) {
            if (requests[i].status === 404 || !requests[i].data || !requests[i].data.objekt) {
                logger.warn(`Failed to fetch metadata for Objekt of ID ${batch[i].id}`)
                continue
            }

            const metadata = requests[i].data.objekt
            const collectionId = metadata.collectionId.toLowerCase().replaceAll(' ', '-')

            let collection: Collection | undefined
            
            if (data.has(Collection.name))
                collection = data.get(Collection.name)?.find(c => c.id === collectionId) as Collection
            if (!collection)
                collection = await store.get(Collection, collectionId)

            if (!collection) {
                collection = new Collection({
                    id: collectionId,
                    artists: metadata.artists,
                    member: metadata.member,
                    season: metadata.season,
                    class: metadata.class,
                    number: metadata.collectionNo,
                    thumbnail: metadata.thumbnailImage,
                    front: metadata.frontImage,
                    back: metadata.backImage,
                    textColor: metadata.textColor,
                    timestamp: (data.get(Transfer.name)?.find(t => (t as Transfer).objekt.id === batch[i].id) as Transfer).timestamp
                })
                if (data.has(Collection.name))
                    data.get(Collection.name)?.push(collection)
                else
                    data.set(Collection.name, [collection])
            }

            const objekt = new Objekt({
                ...batch[i],
                collection: collection,
                serial: metadata.objektNo,
                transferrable: metadata.transferable
            })

            for (const transfer of data.get(Transfer.name)?.filter(t => (t as Transfer).objekt.id === batch[i].id)!)
                (transfer as Transfer).objekt = objekt
            
            data.get(Objekt.name)![data.get(Objekt.name)?.findIndex(o => o.id === batch[i].id)!] = objekt
        }
    }
}
