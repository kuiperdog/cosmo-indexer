import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import {Collection} from "./collection.model"

@Entity_()
export class Objekt {
    constructor(props?: Partial<Objekt>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Collection, {nullable: true})
    collection!: Collection | undefined | null

    @Column_("int4", {nullable: true})
    serial!: number | undefined | null

    @Column_("bool", {nullable: true})
    transferrable!: boolean | undefined | null

    @Index_()
    @Column_("text", {nullable: true})
    owner!: string | undefined | null
}
