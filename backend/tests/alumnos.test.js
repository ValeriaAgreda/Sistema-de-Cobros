import assert from 'node:assert/strict'
import router from '../src/routes/alumnos.routes.js'
import { pool } from '../src/config/db.js'
const calls=[]
let results=[]
const connection={
  execute:async(sql,args)=>{calls.push({sql,args});const result=results.shift();if(result instanceof Error)throw result;return [result]},
  beginTransaction:async()=>calls.push({sql:'BEGIN'}),commit:async()=>calls.push({sql:'COMMIT'}),rollback:async()=>calls.push({sql:'ROLLBACK'}),release:()=>calls.push({sql:'RELEASE'}),
}
pool.getConnection=async()=>connection
pool.execute=connection.execute
async function invoke(method,path,body={},query={}) {
  const handler=router.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack[0].handle
  const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}}
  let error
  await handler({params:{id:7},body,query},res,err=>{error=err})
  return {res,error}
}
const body={nombres:' Ana ',apellidos:' Rojas ',fecha_ingreso:'2026-10-09',programa_id:1}
results=[[]];await invoke('get','/',{}, {buscar:'ALU-00007'})
assert.match(calls[0].sql,/a.estado='activo' AND \(/)
assert.deepEqual(calls[0].args,['%ALU-00007%','%ALU-00007%'])
calls.length=0;results=[{affectedRows:1},{affectedRows:1}]
assert.equal((await invoke('delete','/:id')).res.statusCode,200)
assert.match(calls[1].sql,/SET estado='retirado'/)
assert.match(calls[2].sql,/SET activa=0/)
assert(!calls.some(c=>/DELETE FROM/.test(c.sql)))
assert(calls.some(c=>c.sql==='COMMIT'))
calls.length=0;results=[{affectedRows:1},new Error('database failure')]
assert((await invoke('delete','/:id')).error)
assert(calls.some(c=>c.sql==='ROLLBACK'));assert(!calls.some(c=>c.sql==='COMMIT'))
calls.length=0;results=[[{id:7}],[{id:1}],{affectedRows:1},[{id:2,programa_id:1}],{affectedRows:1}]
assert.equal((await invoke('put','/:id',body)).res.statusCode,200)
assert(!calls.some(c=>/INSERT INTO inscripciones/.test(c.sql)))
assert(!calls.some(c=>/UPDATE (mensualidades|pagos)/.test(c.sql)))
assert.equal(calls.find(c=>/UPDATE alumnos/.test(c.sql)).args[0],'Ana')
calls.length=0;results=[[{id:7}],[{id:1}],{affectedRows:1},[{id:2,programa_id:2}],{affectedRows:1},{insertId:3}]
assert.equal((await invoke('put','/:id',body)).res.statusCode,200)
assert(calls.some(c=>/SET activa=0/.test(c.sql)))
assert(calls.some(c=>/INSERT INTO inscripciones/.test(c.sql)))
calls.length=0;results=[[]]
assert.equal((await invoke('put','/:id',body)).res.statusCode,404)
assert(calls.some(c=>c.sql==='ROLLBACK'))
calls.length=0;results=[]
assert.equal((await invoke('post','/',{...body,monto_primer_mes:-1})).res.statusCode,400)
assert.equal(calls.length,0)
console.log('7 comprobaciones correctas: filtro activo, eliminación lógica, rollback, edición, cambio de programa, alumno inexistente y validación.')
await pool.end()
