import {pool} from '../db.js';
import crypto from 'crypto';

export const getUsers = async (req, res)=>{
    const { rows } = await pool.query('SELECT * FROM users');
    res.json(rows);
}

export const getUser = async (req, res)=>{
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1',[id])

    if(rows.length === 0){
        return res.status(404).json('no se encontro a este usuario');
    }
    res.json(rows[0]);
}

export const createUser = async (req, res)=>{

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
},
    privateKeyEncoding: {
    type: 'pkcs1',
    format: 'pem'
    }
});

    const publicKeyBuffer = Buffer.from(publicKey);
    const publicKeyHex = publicKeyBuffer.toString('hex');

    const pass = '12345';

    try{
    const data = req.body;
    const { rows } = await pool.query(
        'INSERT INTO users (name, email, password, publickey, privatekey, publickeyhash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *', 
        [data.name, data.email, pass, publicKey, privateKey, publicKeyHex]
    );
    return res.json(rows[0]);
    }catch(error){

        if(error?.code === "23505"){
            return res.status(409).json({message: 'El email ya existe'});
        }

        return res.status(500).json({message:'Internal server error'});
    }
};

export const deleteUser = async (req, res)=>{
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);


    if(rowCount === 0){
        return res.status(404).json({message: "User not found"})
    }
    
    return res.sendStatus(204);
}

export const updateUser = async (req, res)=>{
    const { id } = req.params;
    const data = req.body;

    const { rows } = await pool.query('UPDATE users SET name = $1, password = $2, email = $3, publickey = $4, privatekey = $5, publickeyhash = $6 WHERE id = $7 RETURNING *', [data.name, data.password, data.email, data.publickey, data.privatekey, data.publickeyhash, id])

    return res.json(rows[0]);
}