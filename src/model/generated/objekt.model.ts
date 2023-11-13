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
    collection!: Collection

    @Column_("int4", {nullable: false})
    serial!: number

    @Column_("bool", {nullable: false})
    transferrable!: boolean

    @Index_()
    @Column_("text", {nullable: false})
    owner!: string
}
