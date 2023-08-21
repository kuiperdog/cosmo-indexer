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

export const processor = new EvmBatchProcessor()
    .setDataSource({
        archive: lookupArchive('polygon'),
        chain: 'https://polygon-rpc.com',
    })
    .setFinalityConfirmation(10)
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
        address: [
            '0xA4B37bE40F7b231Ee9574c4b16b7DDb7EAcDC99B',
            '0x0fB69F54bA90f17578a59823E09e5a1f8F3FA200',
        ],
        topic0: [Objekt.events.Transfer.topic],
        transaction: true,
    })


export type Fields = EvmBatchProcessorFields<typeof processor>
export type Context = DataHandlerContext<Store, Fields>
export type Block = BlockHeader<Fields>
export type Log = _Log<Fields>
export type Transaction = _Transaction<Fields>
