module.exports = class Data1692600958722 {
    name = 'Data1692600958722'

    async up(db) {
        await db.query(`CREATE TABLE "transfer" ("id" character varying NOT NULL, "from" text NOT NULL, "to" text NOT NULL, "timestamp" numeric NOT NULL, "objekt_id" character varying, CONSTRAINT "PK_fd9ddbdd49a17afcbe014401295" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_98d4c0e33193fdd3edfc826c37" ON "transfer" ("objekt_id") `)
        await db.query(`CREATE TABLE "objekt" ("id" character varying NOT NULL, "serial" integer NOT NULL, "collection_id" character varying, CONSTRAINT "PK_a50fda223abd7f6ae55f2cf629f" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_cc0196669f13f5958a307824a2" ON "objekt" ("collection_id") `)
        await db.query(`CREATE TABLE "collection" ("id" character varying NOT NULL, "thumbnail" text NOT NULL, "front" text NOT NULL, "back" text NOT NULL, "artists" text array NOT NULL, "class" text NOT NULL, "member" text NOT NULL, "season" text NOT NULL, "number" text NOT NULL, CONSTRAINT "PK_ad3f485bbc99d875491f44d7c85" PRIMARY KEY ("id"))`)
        await db.query(`ALTER TABLE "transfer" ADD CONSTRAINT "FK_98d4c0e33193fdd3edfc826c37f" FOREIGN KEY ("objekt_id") REFERENCES "objekt"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "objekt" ADD CONSTRAINT "FK_cc0196669f13f5958a307824a2b" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`DROP TABLE "transfer"`)
        await db.query(`DROP INDEX "public"."IDX_98d4c0e33193fdd3edfc826c37"`)
        await db.query(`DROP TABLE "objekt"`)
        await db.query(`DROP INDEX "public"."IDX_cc0196669f13f5958a307824a2"`)
        await db.query(`DROP TABLE "collection"`)
        await db.query(`ALTER TABLE "transfer" DROP CONSTRAINT "FK_98d4c0e33193fdd3edfc826c37f"`)
        await db.query(`ALTER TABLE "objekt" DROP CONSTRAINT "FK_cc0196669f13f5958a307824a2b"`)
    }
}
