module.exports = class Data1693815610512 {
    name = 'Data1693815610512'

    async up(db) {
        await db.query(`CREATE TABLE "vote" ("id" character varying NOT NULL, "poll" numeric NOT NULL, "amount" numeric NOT NULL, "from" text NOT NULL, "timestamp" numeric NOT NULL, CONSTRAINT "PK_2d5932d46afe39c8176f9d4be72" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_ca61f6c872c193ee5f8cd1f47e" ON "vote" ("poll") `)
        await db.query(`CREATE INDEX "IDX_701e95fc921b4ca38caa9a4a2c" ON "vote" ("amount") `)
        await db.query(`CREATE INDEX "IDX_8ea4539f32b721cfed8cb4796c" ON "vote" ("from") `)
        await db.query(`CREATE INDEX "IDX_8d701dbd422ac5e3e1d7a9a0d1" ON "vote" ("timestamp") `)
    }

    async down(db) {
        await db.query(`DROP TABLE "vote"`)
        await db.query(`DROP INDEX "public"."IDX_ca61f6c872c193ee5f8cd1f47e"`)
        await db.query(`DROP INDEX "public"."IDX_701e95fc921b4ca38caa9a4a2c"`)
        await db.query(`DROP INDEX "public"."IDX_8ea4539f32b721cfed8cb4796c"`)
        await db.query(`DROP INDEX "public"."IDX_8d701dbd422ac5e3e1d7a9a0d1"`)
    }
}
