const express = require('express');
const router = express.Router();
const { Pool } = require('pg');


async function connect_DB_API() {
  const pool = new Pool({
    user: process.env.DB_API_USER,
    password: process.env.DB_API_PASS,
    host: process.env.DB_API_HOST,
    database: process.env.DB_API_DATABASE,
    port: process.env.DB_API_PORT
  });
  return pool;
}


router.get('/groups', async (req, res) => {
    const pool = await connect_DB_API(); 
    try {
      const result = await pool.query('SELECT * FROM "group"');
      res.json(result.rows);
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });

  router.post('/groups/add', async (req, res) => {
    const pool = await connect_DB_API(); 
    try {
      const { group_name,department, is_active, created_by, created_date, is_delete } = req.body;

      if (!group_name || group_name.trim() === '') {
        return res.status(400).json({ message: 'Group name cannot be empty' });
      }

      const duplicateCheck = await pool.query(
        `SELECT id FROM "group" WHERE lower(group_name) = lower($1) and  is_delete = '0'`,
        [group_name]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(409).json({ message: 'Group name already exists' });
      }

      const newGroup = await pool.query(
        `INSERT INTO "group" (group_name,department, is_active, is_delete, created_by, created_date)
         VALUES ($1, $2, $3, $4, $5,$6) RETURNING *`,
        [group_name,department, is_active, is_delete, created_by, created_date]
      );

      res.status(201).json(newGroup.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }finally {
      await pool.end()
   }
  });


  router.get('/groups/:id', async (req, res) => {
    const { id } = req.params;
    const pool = await connect_DB_API(); 
    try {
      const result = await pool.query('SELECT * FROM "group" WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        res.status(200).json(result.rows[0]);
      } else {
        res.status(404).json({ message: 'Group not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });

  router.put('/groups/:id', async (req, res) => {
    const pool = await connect_DB_API(); 
    const { id } = req.params;
    const { group_name,department, is_active, updated_by, updated_date } = req.body;

    try {

      const duplicateCheck = await pool.query(
        `SELECT id FROM "group" WHERE lower(group_name) = lower($1) AND id <> $2 and is_delete = '0'`,
        [group_name, id]
      );
      if (duplicateCheck.rowCount > 0) {

        return res.status(409).json({ message: 'Group name already exists' });
      }

      const result = await pool.query(
        'UPDATE "group" SET group_name = $1, is_active = $2, updated_by = $3, updated_date = $4,department = $6 WHERE id = $5 ',
        [group_name, is_active, updated_by, updated_date, id,department]
      );

      if (result.rowCount > 0) {
        res.status(200).json({ message: 'Group updated successfully' });
      } else {
        res.status(404).json({ message: 'Group not found' });
      }
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });

  router.delete('/groups/:id', async (req, res) => {
    const pool = await connect_DB_API(); 
    const { id } = req.params;
    console.log(id)
    try {

      const result = await pool.query(
        `UPDATE "group" SET is_delete = $1 , updated_by = 'admin', updated_date = now() WHERE id = $2 RETURNING *`,
        ['1', id]
      );
      console.log(result)
      if (result.rowCount > 0) {
        res.status(200).json({ message: 'Group marked as deleted successfully' });
      } else {
        res.status(404).json({ message: 'Group not found' });
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).json({ message: 'Failed to delete group' });
    }finally {
      await pool.end()
   }
  });







  router.get('/groups_permissions', async (req, res) => {
    const pool = await connect_DB_API(); 
    try {
      const result = await pool.query(`
            SELECT
                a.id AS group_id,
                a.group_name,
                COALESCE(b.totat_user, 0) AS totat_user,
                CASE
                    WHEN c.group_id IS NOT NULL THEN 'Yes'
                    ELSE 'No'
                END AS Menu_Permissions,
                CASE
                    WHEN d.group_id IS NOT NULL THEN 'Yes'
                    ELSE 'No'
                END AS API_Permissions
            FROM
                (SELECT id, group_name FROM "group" WHERE is_delete = '0') a
            LEFT JOIN
                (SELECT group_id, COUNT(user_id) AS totat_user FROM group_users
                 GROUP BY group_id) b
            ON a.id = b.group_id
            LEFT JOIN
                (SELECT DISTINCT group_id FROM group_menu WHERE is_active = '1') c
            ON a.id = c.group_id
            LEFT JOIN
                (SELECT DISTINCT group_id FROM group_api WHERE is_active = '1') d
            ON a.id = d.group_id;
        `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });

  router.get('/group_users/:group_id', async (req, res) => {
    const { group_id } = req.params;
    const pool = await connect_DB_API();

    try {
      const result = await pool.query(`SELECT a.id, a.group_id, a.user_id,b."name" as user_name, a.created_by, a.created_date, a.updated_by, a.updated_date
            FROM public.group_users  AS a
            LEFT JOIN public.users AS b
            ON a.user_id = b.id
            where  a.group_id = $1`, [group_id]);

      if (result.rows.length > 0) {
        res.status(200).json(result.rows);
      } else {
        res.status(404).json({ message: 'Group not found' });
      }
    } catch (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await pool.end();
    }
  });


  router.get('/group_users/not_in/:group_id', async (req, res) => {
    const { group_id } = req.params;
    const pool = await connect_DB_API();

    try {
      const result = await pool.query(`
        SELECT cast(id as text)  as user_id,name as user_name
        FROM public.users
        WHERE id NOT IN (
            SELECT a.user_id::int
            FROM public.group_users AS a
        )
      `);

      if (result.rows.length > 0) {
        res.status(200).json(result.rows);
      } else {
        res.status(404).json({ message: 'No users found' });
      }
    } catch (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await pool.end();
    }
  });

  router.post('/group_users/user/add', async (req, res) => {

    const { group_id, user_ids, created_by } = req.body;
    const pool = await connect_DB_API();
    console.log('group_id:', group_id);
    console.log('user_ids:', user_ids);
    console.log('created_by:', created_by);
    if (!group_id || !user_ids || !Array.isArray(user_ids)) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const insertQuery = `
            INSERT INTO public.group_users (group_id, user_id, created_by, created_date)
            VALUES ($1, $2, $3, NOW())
            RETURNING id;
        `;

        const insertPromises = user_ids.map(user_id => {
            return client.query(insertQuery, [group_id, user_id, created_by]);
        });

        const results = await Promise.all(insertPromises);

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Users added to group successfully',
            data: results.map(result => result.rows[0])
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error inserting users into group:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
        await pool.end();
    }
});

router.post('/group_users/user/remove', async (req, res) => {
  const { group_id, user_ids, created_by } = req.body;
  console.log(group_id)
  console.log(user_ids)

  if (!group_id || !user_ids || !Array.isArray(user_ids)) {
      return res.status(400).json({ error: 'Invalid input data' });
  }

  const pool = await connect_DB_API();
  const client = await pool.connect();

  try {
      await client.query('BEGIN');

      const deleteQuery = `
          DELETE FROM public.group_users
          WHERE group_id = $1 AND user_id = ANY($2)
      `;

      await client.query(deleteQuery, [group_id, user_ids]);

      await client.query('COMMIT'); // Commit the transaction

      res.status(200).json({ message: 'Users removed successfully' });
  } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error removing users:', error);
      res.status(500).json({ error: 'Internal server error' });
  } finally {
      client.release();
  }
});




  module.exports = router;