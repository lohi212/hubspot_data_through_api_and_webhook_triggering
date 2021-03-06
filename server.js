const express = require("express")
const bodyParser = require("body-parser")
const fetch = require('node-fetch');
const pg = require('pg');
const request = require('request');
const Hubspot = require('hubspot');
const Analytics = require("@rudderstack/rudder-sdk-node");
const client = new Analytics('1lMWZsS6PIYIgF6qJBG9NK4oPzH', 'https://hosted.rudderlabs.com/v1/batch'); 
const { v4: uuidv4 } = require('uuid');

const app = express()
const PORT = 3000

const conString = "postgres://gunazoip:nHADdQIwNuCkkPX84tlN8kg3mYlaK0Ad@suleiman.db.elephantsql.com:5432/gunazoip" //Can be found in the Details page
const pgClient = new pg.Client(conString);

app.use(express.static('public/'));


app.use(bodyParser.json());
app.post('/sample-hook', (req, res) => {
  console.log(req.body);
});

app.post("/hook", (req, res) => {
  const data={};
  
  data.tenantId=req.body[0].portalId;
  //console.log(req.body[0].portalId);
  let access_token;
  let refresh_token;
  
  console.log('hook triggered');
  const fetchQuery = `SELECT * FROM "public"."hubspotusers" WHERE portal_id = '${data.tenantId}';`;
  //checks if that portalid already exists.
  pgClient.query(fetchQuery, function(err, result) {
    if(err) {
      return console.error('error running query', err);
    }
    access_token = result.rows[0].access_token;
    refresh_token = result.rows[0].refresh_token;

    if (access_token && refresh_token) { //not undefined
      
      if(req.body[0].subscriptionType.includes('contact')){
        fetchAllContacts(access_token, data.tenantId);
        console.log('contacts hook triggered');
      }
      if(req.body[0].subscriptionType.includes('company')){
        fetchAllCompanies(access_token, data.tenantId);
        console.log('companies hook triggered');
      }
      if(req.body[0].subscriptionType.includes('deal')){
        fetchAllDeals(access_token, data.tenantId);
        console.log('deals hook triggered');
      }
      //fetchAllCompanies(access_token, data.tenantId);
      //if exists-then find that contact and edit ,delete existing ones and insert
      res.status(200).end()
    } else {
      res.json({ message: 'access token not found' });
    }
  });	
	
});

/**
 * Redirect URL - Hubspot Authentication
 */

pgClient.connect(function(err) {
  console.log('connection successfull');
});

function fetchAllContacts(accessToken, portalId) {
  const hubspot = new Hubspot({
    accessToken,
  });
  console.log(portalId);
const deleteCmd = `DELETE FROM hubcontacts WHERE tenant_id='${portalId}';`;
  
  pgClient.query(deleteCmd, function(err, result) {
    if(err) {
      return console.error('error running insert contacts query-delcmd', err);
    }
    hubspot.contacts
    .get({count: 100 })
    .then(results => { 
	client.track({
		
        event: `${portalId}`,
        userId: JSON.stringify(results),
    });
    //console.log(results.contacts.length);
      results.contacts.forEach(result => {  
           //console.log();        
        const data = { //table constraints
            
          first_name: result?.properties?.firstname?.value,
          last_name: result?.properties?.lastname?.value,
          profile_url: result['profile-url'],
          vid: uuidv4(),
        };
        //console.log("cfgvcv: "+result.properties.lastname.value);
        const text = 'INSERT INTO hubcontacts(tenant_id, first_name, last_name, profile_url, vid) VALUES($1, $2, $3, $4, $5)';
        const values = [portalId, data.first_name, data.last_name, data.profile_url, data.vid];
        
        pgClient.query(text, values, function(err, result) {
          if(err) {
            return console.error('error running insert contacts query-insertquery', err);
          }
          //console.log('insert query');
          
        });
      })
    })
    .catch(err => {
      console.error(err)
    });
  });
}

function fetchAllCompanies(accessToken, portalId) {
    const hubspot = new Hubspot({
      accessToken,
    });
  const deleteCmd = `DELETE FROM hubcompanies WHERE tenant_id='${portalId}';`;
    
    pgClient.query(deleteCmd, function(err, result) {
      if(err) {
        return console.error('error running insert companies query-delcmd', err);
      }
      hubspot.companies
      .get({properties: 'website' })
      .then(results => { 
      client.track({
          
          event: `${portalId}`,
          userId: JSON.stringify(results),
      });
      //console.log(JSON.stringify(results.companies, null, 4))
      results.companies.forEach(result => {
            const data = { //table constraints            
            company_id:uuidv4(),
            company_name: result?.properties?.website?.value,
            
        };  
          const text = 'INSERT INTO hubcompanies(tenant_id, company_id,company_name) VALUES($1, $2, $3)';
          const values = [portalId, data.company_id, data.company_name];
          
          pgClient.query(text, values, function(err, result) {
            if(err) {
              return console.error('error running insert companies query-insertquery', err);
            }
            //console.log('insert query');
            
          });
        })
      })
      .catch(err => {
        console.error(err)
      });
    });
  }
  

function fetchAllDeals(accessToken, portalId) {
    const hubspot = new Hubspot({
      accessToken,
    });
  const deleteCmd = `DELETE FROM hubdeals WHERE tenant_id='${portalId}';`;
    
    pgClient.query(deleteCmd, function(err, result) {
      if(err) {
        return console.error('error running insert deals query-delcmd', err);
      }
      hubspot.deals
      .get({properties: 'dealname' })
      .then(results => { 
      client.track({
          
          event: `${portalId}`,
          userId: JSON.stringify(results),
      });
      //console.log(JSON.stringify(results.deals, null, 4))
      results.deals.forEach(result => {
            const data = { //table constraints            
            deal_id:uuidv4(),
            deal_name: result?.properties?.dealname?.value,
            
        };  
        console.log(result?.properties?.dealname?.value);
          const text = 'INSERT INTO hubdeals(tenant_id, deal_id,deal_name) VALUES($1, $2, $3)';
          const values = [portalId, data.deal_id, data.deal_name];
          
          pgClient.query(text, values, function(err, result) {
            if(err) {
              return console.error('error running insert deals query-insertquery', err);
            }
            //console.log('insert query');
            
          });
        })
      })
      .catch(err => {
        console.error(err)
      });
    });
  }

app.get('/redirect', (req, res) => {
 const { code } = req.query;
  const formData = {
    grant_type: 'authorization_code',
    client_id:  '13e6b8fd-d6f3-4e19-b8f8-d29401aa5378',
    client_secret: 'ab6e5fb2-47bf-4da1-8a5c-54b401f594f0',
    redirect_uri: 'https://hubspotsync3.loca.lt/redirect',
    code,
  };

  request.post('https://api.hubapi.com/oauth/v1/token', { form: formData }, (err, data) => {
	const { access_token, refresh_token } = JSON.parse(data.body);
    request.get('https://api.hubapi.com/integrations/v1/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }, async (error, response) => {
        const { portalId } = JSON.parse(response.body)

        

        const fetchQuery = `SELECT * FROM "public"."hubspotusers" WHERE portal_id = '${portalId}';`;
        //if id exists then fetchallcontacts();
        pgClient.query(fetchQuery, function(err, result) {
          if(err) {
            return console.error('error running query', err);
          }
          if (result.rows[0]) {
            const updateCmd = `
              update hubspotusers 
              set access_token = '${access_token}', refresh_token = '${refresh_token}'
              where portal_id = '${portalId}'
            `;

            fetchAllContacts(access_token, portalId);
            fetchAllCompanies(access_token, portalId);
            fetchAllDeals(access_token, portalId);
            pgClient.query(updateCmd, function(err, result) {
                if(err) {
                  return console.error('error running update query', err);
                }
                console.log('update query');
                
            });

          } else {
           
            const text = 'INSERT INTO hubspotusers(portal_id, access_token, refresh_token) VALUES($1, $2, $3)'
            const values = [portalId, access_token, refresh_token];

            fetchAllContacts(access_token, portalId);
            fetchAllCompanies(access_token, portalId);
            fetchAllDeals(access_token, portalId);
            pgClient.query(text, values, function(err, result) {
                if(err) {
                  return console.error('error running insert query', err);
                }
                console.log('insert query', result.rows[0]);
               
            });
          }
        });

    });
     res.json(data);
  });
});


app.get('/test-url', (req, res) => {
    res.json({ message: 'Hello world!' });
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`))


