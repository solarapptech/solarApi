import {Router} from 'express';
import crypto from 'crypto';
import {pool} from '../db.js';
import {createUser, deleteUser, getUser, getUsers, updateUser, } from '../controllers/users.controllers.js';
const router = Router();
import moment from 'moment-timezone';
import { EventSource } from 'eventsource';
moment.locale('es');  
let venezuelaTime = moment().tz('America/Caracas').format('YYYY-MM-DD HH:mm');

router.get('/users', getUsers);

router.get("/users/:id", getUser);

router.post('/users', createUser);

router.delete('/users/:id', deleteUser)

router.put('/users/:id', updateUser)


let pass = '';
let publick = '';
let privatek = '';


router.get('/login', (req,res) =>{
  res.send(`<html>
      <head> 
          <title>Login</title>
      </head>
      <body>
          <form method = "POST" action ="/auth">
              Nombre de usuario: <input type ="text" name="username"><br/>
              Contraseña: <input type ="password" name="password"><br/>
              <input type ="submit" value = "Iniciar sesion"/>
        </form> 
      </body>
  </html>`)
});


router.post('/auth', async (req, res) => {
    const { username, password } = req.body;
    const query = 'SELECT COUNT(*) FROM users WHERE name = $1 AND password = $2';
    const result = await pool.query(query, [username, password]);
    const authenticated = result.rows[0].count > 0;

    if(authenticated){

      const query = 'SELECT id, publickeyhash, publickey, privatekey FROM users WHERE name = $1 AND password = $2';
      const result = await pool.query(query, [username, password]);
      if (result.rows.length > 0) {
        // const userId = result.rows[0].id;

        const publicKeyHash = result.rows[0].publickeyhash;
        publick = result.rows[0].publickey;
        privatek = result.rows[0].privatekey;
        pass = publicKeyHash;
        
        
      // return res.status(200).header('authorization', publicKeyHash).json({
      //   "Estado": "Activo",
      //   "Url de Acceso a Api": "http://localhost:3000/api?accessToken=" + publicKeyHash
      // })
      return res.status(200).header('authorization', publicKeyHash).send(
        `<html>
        <head> 
        <title>Bienvenido</title>
        <script>
        const aUrl = "https://solarapi-vedx.onrender.com";
        const redirectionUrl = aUrl + "/" + "api?accessToken=${publicKeyHash}";
        function redirectToUrl(event) {
        event.preventDefault();
        window.location.href = redirectionUrl;
        }
        function displayAcc(){
          document.getElementById('accesstkn').innerText = '${publicKeyHash}';        
        }
        window.onload = displayAcc;
        </script>
        </head>
        <body>
        <h1>¡Bienvenido a Solar Api!</h1>
        <div>Hash de Acceso:<div>
        <p id="accesstkn" style = "margin-top: 12px"></p>
        <form onsubmit="redirectToUrl(event)">
        <input type="submit" value="Ir a API">
        </form> 
      </body>
      </html>`
    )
  }
}
  return res.status(500).json({ error: 'Error en el servidor' });
});
  
router.get('/auth', (req, res) => {
  return res.status(401).json({ error: 'La solicitud requiere autenticación' });
});

function validateToken (req, res, next) {
    const accesstoken = req.headers['authorization'] || req.query.accessToken;
     if (accesstoken === pass) {
        next();
    } else {
        res.sendStatus(403);
    }
}

router.get('/api', validateToken, (req, res) => { 

  const urls = [
    //bcv dolar
    'https://solartech.onrender.com/info1',
    //bcv euro
    'https://solartech.onrender.com/info4',
    //paralelo
    'https://solartech.onrender.com/info2',
    //paypal
    'https://solartech.onrender.com/info6'
  ];

  const dataArray = [];
  const dataNumber = [];

  urls.forEach((url, index) => {
    const eventSource = new EventSource(url);
  
    eventSource.onmessage = function(event) {
      dataArray[index] = event.data;
      dataNumber[index] = parseFloat(dataArray[index]);
      
      // Check if all data is collected
      if (dataArray.length === urls.length && !dataArray.includes(undefined)) {

      // Data a Enviar
      let valores = (
      {
              "timestamp": venezuelaTime,
              "BCV - Dolar": dataNumber[0],
              "BCV - Euro": dataNumber[1],
              "Paralelo": dataNumber[2],
              "PayPal": dataNumber[3],
        }
      );
      let valoresJSON = JSON.stringify(valores);
        
      const encryptDo = crypto.publicEncrypt({
      key: publick,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
      }, Buffer.from(valoresJSON));

      const decryptData = crypto.privateDecrypt({
        key: privatek,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },encryptDo);

      res.json({
          'Tasas': JSON.parse(decryptData.toString())
      });
      }
    }
    eventSource.onerror = function(err) {
      console.error(`Error fetching data from ${url}:`, err);
    };
  });
});

export default router
