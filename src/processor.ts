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

const objektContracts: string[] = [
    '0xA4B37bE40F7b231Ee9574c4b16b7DDb7EAcDC99B',
    '0x0fB69F54bA90f17578a59823E09e5a1f8F3FA200'
]
const governorContracts: string[] = [
    '0xc3E5ad11aE2F00c740E74B81f134426A3331D950',
    '0x8466e6E218F0fe438Ac8f403f684451D20E59Ee3'
]

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
            data: true,
        },
        transaction: {
            hash: true,
        },
    })
    .addLog({
        address: objektContracts,
        topic0: [Objekt.events.Transfer.topic],
        transaction: true,
    })
    .addLog({
        address: governorContracts,
        topic0: [Governor.events.Voted.topic],
        transaction: true
    })

export const contracts: string[] = [...objektContracts, ...governorContracts].map(contract => contract.toLowerCase())

export type Fields = EvmBatchProcessorFields<typeof processor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
