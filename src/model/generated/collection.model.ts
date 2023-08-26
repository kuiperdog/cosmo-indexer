import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import {Objekt} from "./objekt.model"

@Entity_()
export class Collection {
    constructor(props?: Partial<Collection>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    thumbnail!: string

    @Column_("text", {nullable: false})
    front!: string

    @Column_("text", {nullable: false})
    back!: string

    @Column_("text", {array: true, nullable: false})
    artists!: (string)[]

    @Column_("text", {nullable: false})
    class!: string

    @Column_("text", {nullable: false})
    member!: string

    @Column_("text", {nullable: false})
    season!: string

    @Column_("text", {nullable: false})
    number!: string

    @Column_("text", {nullable: false})
    textColor!: string

    @OneToMany_(() => Objekt, e => e.collection)
    objekts!: Objekt[]
}
