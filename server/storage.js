import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

export const emptyStore = () => ({users:{},challenges:{},sessions:{},claimedTransactions:{},oauthPending:{},rateLimits:{}});

// One locked snapshot preserves the MVP's existing data model across instances.
// Every read-modify-write is a transaction, including OAuth state and throttles.
export function createStorage({file, connectionString=process.env.DATABASE_URL, pool:providedPool}={}) {
  let pool=providedPool, queue=Promise.resolve();
  function getPool() {
    pool ||= new pg.Pool({connectionString,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true});
    return pool;
  }
  async function postgresTransaction(work) {
    const client=await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '35s'");
      await client.query("SET LOCAL statement_timeout = '40s'");
      // The transaction-scoped lock also serializes first-run schema creation.
      await client.query('SELECT pg_advisory_xact_lock(99801, 1)');
      await client.query('CREATE TABLE IF NOT EXISTS odyssey_state (id integer PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL)');
      await client.query('INSERT INTO odyssey_state (id,data) VALUES (1,$1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(emptyStore())]);
      const result=await client.query('SELECT data FROM odyssey_state WHERE id=1 FOR UPDATE');
      const data={...emptyStore(),...result.rows[0].data};
      const value=await work(data);
      await client.query('UPDATE odyssey_state SET data=$1::jsonb WHERE id=1',[JSON.stringify(data)]);
      await client.query('COMMIT');
      return value;
    } catch(error) {
      await client.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally {client.release();}
  }
  async function fileTransaction(work) {
    let data=emptyStore();
    try{data={...data,...JSON.parse(await readFile(file,'utf8'))};}
    catch(error){if(error.code!=='ENOENT')throw error;}
    const value=await work(data);
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file+'.tmp',JSON.stringify(data,null,2),{mode:0o600});
    await rename(file+'.tmp',file);
    return value;
  }
  return {
    transaction(work) {
      if(connectionString||providedPool)return postgresTransaction(work);
      if(process.env.VERCEL)return Promise.reject(new Error('DATABASE_URL is required on Vercel.'));
      const result=queue.then(()=>fileTransaction(work));queue=result.catch(()=>{});return result;
    },
    async close(){if(pool)await pool.end();}
  };
}
