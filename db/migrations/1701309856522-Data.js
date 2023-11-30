module.exports = class Data1701309856522 {
    name = 'Data1701309856522'

    async up(db) {
        await db.query(`CREATE INDEX "IDX_4c098d306adb4722a962ec89ea" ON "vote" ("contract") `)
        await db.query(`CREATE INDEX "IDX_ca61f6c872c193ee5f8cd1f47e" ON "vote" ("poll") `)
        await db.query(`CREATE INDEX "IDX_701e95fc921b4ca38caa9a4a2c" ON "vote" ("amount") `)
        await db.query(`CREATE INDEX "IDX_510ba94c39a5f9609e40404854" ON "vote" ("candidate") `)
        await db.query(`CREATE INDEX "IDX_8d701dbd422ac5e3e1d7a9a0d1" ON "vote" ("timestamp") `)
        await db.query(`CREATE INDEX "IDX_8456d139615e911bc462e25293" ON "como" ("balance") `)
    }

    async down(db) {
        await db.query(`DROP INDEX "public"."IDX_4c098d306adb4722a962ec89ea"`)
        await db.query(`DROP INDEX "public"."IDX_ca61f6c872c193ee5f8cd1f47e"`)
        await db.query(`DROP INDEX "public"."IDX_701e95fc921b4ca38caa9a4a2c"`)
        await db.query(`DROP INDEX "public"."IDX_510ba94c39a5f9609e40404854"`)
        await db.query(`DROP INDEX "public"."IDX_8d701dbd422ac5e3e1d7a9a0d1"`)
        await db.query(`DROP INDEX "public"."IDX_8456d139615e911bc462e25293"`)
    }
}
