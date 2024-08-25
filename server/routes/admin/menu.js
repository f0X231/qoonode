
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






  router.post('/menu_url/add', async (req, res) => {
    const pool = await connect_DB_API(); 
    try {
      let { menu, url, parent_id, created_by, created_date } = req.body;
      console.log(req.body)

      if (!menu || menu.trim() === '') {
        return res.status(400).json({ message: 'Menu name cannot be empty' });
      }

      const duplicateCheck = await pool.query(
        `SELECT id FROM menu_url WHERE lower(menu) = lower($1) AND is_delete = '0'`,
        [menu]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(409).json({ message: 'Menu name already exists' });
      }

      if (!parent_id) {
        parent_id = null;

        const newMenuUrl = await pool.query(
          `INSERT INTO menu_url (menu, url, level, parent_id, sequence, is_delete, created_by, created_date)
           SELECT $1, $2, 0, $3, COALESCE(MAX(sequence), 0) + 1, '0', $4, $5
           FROM menu_url
           WHERE (parent_id = $3 OR ($3 IS NULL AND parent_id IS NULL))
           AND is_delete = '0'`,
          [menu, url, parent_id, created_by, created_date]
        );

        res.status(201).json(newMenuUrl.rows[0]);

      } else {
        const newMenuUrl = await pool.query(
          `INSERT INTO menu_url (menu, url, level, parent_id, sequence, is_delete, created_by, created_date)
           SELECT $1, $2, 1, $3, COALESCE(MAX(B.sequence), MAX(A.sequence)) + 0.1, '0', $4, $5
           FROM (SELECT sequence FROM menu_url WHERE id = $3 AND is_delete = '0') A
           LEFT JOIN
           (SELECT sequence FROM menu_url WHERE parent_id = $3 AND is_delete = '0') B
           ON 1=1`,
          [menu, url, parent_id, created_by, created_date]
        );

        res.status(201).json(newMenuUrl.rows[0]);
      }
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }finally {
      await pool.end()
   }
  });



  router.get('/menu_url', async (req, res) => {
    const pool = await connect_DB_API(); 
    try {
      const result = await pool.query(`select id,case when parent_id is not null then concat('&nbsp;&nbsp;&nbsp;&nbsp;',menu) else
         menu end as menu  ,url,"level", parent_id, "sequence",
          is_delete, created_by, created_date, updated_by, updated_date
        from  menu_url  where is_delete = '0'
        order by sequence;
         `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });


  router.get('/menu_url/:id', async (req, res) => {
    const { id } = req.params;
    const pool = await connect_DB_API(); 
  
    try {
      const result = await pool.query('SELECT * FROM "menu_url" WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        res.status(200).json(result.rows[0]);
      } else {
        res.status(404).json({ message: 'menu_url not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });

 // /menu-url/parent-id
  router.get('/parent', async (req, res) => {
    const pool = await connect_DB_API(); 
    console.log('s')
    try {
      const result = await pool.query(`
        SELECT DISTINCT id, menu
        FROM public.menu_url
        WHERE parent_id IS NULL and is_delete = '0'
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await pool.end()
    }
  });


  router.put('/menu_url/up/:id', async (req, res) => {
    const { id } = req.params;
    const { updated_by } = req.body;
    const pool = await connect_DB_API(); 
  
    try {

      await pool.query(
        `CALL menu_up($1, $2);`,
        [id, updated_by]
      );

      res.status(200).json({ message: 'Updated successfully' });
    } catch (error) {
      console.error('Error updating', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });


  router.put('/menu_url/down/:id', async (req, res) => {
    const { id } = req.params;
    const { updated_by } = req.body;
    const pool = await connect_DB_API(); 
    try {

      await pool.query(
        `CALL menu_down($1, $2);`,
        [id, updated_by]
      );
      res.status(200).json({ message: 'Updated successfully' });
    } catch (error) {
      console.error('Error updating', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });


  router.delete('/menu_url/delete/:id', async (req, res) => {
    const { id } = req.params;
    const pool = await connect_DB_API();
    const client = await pool.connect(); 
  
    try {
      await client.query('BEGIN');
      const queryText = `UPDATE "menu_url" SET is_delete = $1, updated_by = 'admin', updated_date = now() WHERE id = $2 RETURNING *`;
      await client.query(queryText, ['1', id]);

      const queryText2 = `UPDATE "menu_url" SET is_delete = $1, updated_by = 'admin', updated_date = now() WHERE parent_id = $2 RETURNING *`;
      await client.query(queryText2, ['1', id]);

      await client.query('COMMIT');
      res.json({ message: 'Menu item and its children deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting menu item:', error);
      res.status(500).json({ message: 'Failed to delete menu item' });
    } finally {
      client.release();
      await pool.end();
    }
  });


  router.put('/menu_url/:id', async (req, res) => {
    const { id } = req.params;
    const { menu_name, menu_url, updated_by, updated_date } = req.body;
    const pool = await connect_DB_API(); 
  
    try {

      const duplicateCheck = await pool.query(
        `SELECT id FROM menu_url WHERE lower(menu) = lower($1) AND id <> $2 and is_delete = '0'`,
        [menu_name, id]
      );

      if (duplicateCheck.rowCount > 0) {

        return res.status(409).json({ message: 'Menu name already exists' });
      }

      const result = await pool.query(
        'UPDATE menu_url SET menu = $1, url = $2, updated_by = $3, updated_date = $4 WHERE id = $5',
        [menu_name, menu_url, updated_by, updated_date, id]
      );

      if (result.rowCount > 0) {
        res.status(200).json({ message: 'menu updated successfully' });
      } else {
        res.status(404).json({ message: 'menu not found' });
      }
    } catch (error) {
      console.error('Error updating menu:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }finally {
      await pool.end()
   }
  });

  router.get('/group_menu/:group_id', async (req, res) => {
    const { group_id } = req.params;
    const pool = await connect_DB_API();

    try {
      const result = await pool.query(`SELECT a.id, a.group_id, a.menu_id,b."menu" as menu_name,b.parent_id,b."sequence"  ,a.is_active, a.created_by, a.created_date, a.updated_by, a.updated_date
            FROM public.group_menu  AS a
            LEFT JOIN public.menu_url AS b
            ON a.menu_id = b.id
            where  a.group_id =  $1 order by b."sequence" `, [group_id]);

      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await pool.end();
    }
  });


  router.get('/group_menu/in/:group_id', async (req, res) => {
    const { group_id } = req.params;
    const pool = await connect_DB_API();

    try {
      const result = await pool.query(
        `  SELECT
              a.id,
            case when a.parent_id is not null then concat('&nbsp;&nbsp;&nbsp;&nbsp;',menu) else
                  menu end as menu,a.url,
              a."level",a.parent_id,a."sequence",a.is_delete,a.created_by,a.created_date,a.updated_by,
              a.updated_date, CASE
                  WHEN b.group_id IS NULL THEN '0'
                  ELSE '1'
              END AS in_group FROM
              menu_url a
          LEFT JOIN
              (SELECT * FROM group_menu WHERE group_id =  $1) b
              ON b.menu_id = a.id
          ORDER BY
              a."sequence";
          `,
        [group_id]
      );

      // Return an empty array if no results found
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error querying database:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    } finally {
      await pool.end();
    }
  });




  router.post('/group_menu/menu/add', async (req, res) => {

    const { group_id, menu_ids, created_by } = req.body;
    const pool = await connect_DB_API();
    console.log('group_id:', group_id);
    console.log('menu_ids:', menu_ids);
    console.log('created_by:', created_by);
    if (!group_id || !menu_ids || !Array.isArray(menu_ids)) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const deleteQuery = `
            DELETE FROM public.group_menu
            WHERE group_id = $1
            `;
        await client.query(deleteQuery, [group_id]);
        const insertQuery = `
            INSERT INTO public.group_menu (group_id, menu_id, created_by, created_date)
            VALUES ($1, $2, $3, NOW())
            RETURNING id;
            `;

        const insertPromises = menu_ids.map(menu_id => {
            return client.query(insertQuery, [group_id, menu_id, created_by]);
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


router.post('/group_menu/menu/remove', async (req, res) => {
  const { group_id, menu_ids, created_by } = req.body;
  const pool = await connect_DB_API();
  console.log('group_id:', group_id);
  console.log('menu_ids:', menu_ids);
  console.log('created_by:', created_by);

  if (!group_id || !menu_ids || !Array.isArray(menu_ids)) {
      return res.status(400).json({ error: 'Invalid input data' });
  }

  const client = await pool.connect();

  try {
      await client.query('BEGIN');

      const deleteQuery = `
          DELETE FROM public.group_menu
          WHERE group_id = $1 AND menu_id = ANY($2)
      `;

      await client.query(deleteQuery, [group_id, menu_ids]);

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