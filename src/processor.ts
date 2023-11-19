import {lookupArchive} from '@subsquid/archive-registry'
import {
    BlockHeader,
    DataHandlerContext,
    EvmBatchProcessor,
    EvmBatchProcessorFields,
    Log as _Log,
    Transaction as _Transaction,
} from '@subsquid/evm-processor'
import {Store} from '@subsquid/typeorm-store'
import * as Objekt from './abi/Objekt'
import * as Governor from './abi/Governor'
import * as ERC20 from './abi/ERC20'
import axios from 'axios'

export const processor = new EvmBatchProcessor()
    .setDataSource({
        archive: lookupArchive('polygon'),
        chain: 'https://polygon-rpc.com',
    })
    .setFinalityConfirmation(200)
    .setBlockRange({
        from: 31385244,
    })
    .setFields({
        evmLog: {
            topics: true,
            data: true
        },
        transaction: {
            sighash: true,
            input: true
        }
    })

export async function getContracts(processor: EvmBatchProcessor): Promise<any> {
    const artists = await axios.get('https://api.cosmo.fans/artist/v1')

    const contracts = artists.data.artists.reduce((acc: any, artist: any) => {
        Object.keys(artist.contracts).forEach(key => {
          acc[key] = [...(acc[key] || []), artist.contracts[key].toLowerCase()]
        })
        return acc
    }, {})

    processor
        .addLog({
            address: contracts.Objekt,
            topic0: [Objekt.events.Transfer.topic]
        })
        .addTransaction({
            to: contracts.Objekt,
            sighash: [Objekt.functions.batchUpdateObjektTransferrability.sighash]
        })
        .addLog({
            address: contracts.Governor,
            topic0: [Governor.events.Voted.topic]
        })
        .addTransaction({
            to: contracts.Governor,
            sighash: [Governor.functions.reveal.sighash]
        })
        .addLog({
            address: contracts.Como,
            topic0: [ERC20.events.Transfer.topic]
        })
    
    return contracts
} 

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
