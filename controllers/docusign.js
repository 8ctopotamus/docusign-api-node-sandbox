const fs = require('fs')
const path = require('path')
const axios = require('axios')

const createTabs = (signers, contentHtml) => {
  const placeholders = contentHtml.match(/(?<=\[\[)(.*?)(?=\]\])/g)
  if (!placeholders || placeholders.length === 0) 
    return false
  const tabs = {}
  signers.forEach(({ recipientId }) => {
    tabs[recipientId] = placeholders
      .map(p => {
        const [ type, role, id ] = p.split('_')
        return { type, role, id }
      })
      .reduce((prev, curr) => {
        const { type, role, id } = curr
        const key = `${type}Tabs`
        if(!prev[key] && id === recipientId) {
          prev[key] = [
            {
              recipientId,
              "anchorString": `[[${[ type, role, id ].join('_')}]]`,
              "anchorXOffset": "0",
              "anchorYOffset": "0",
              "anchorIgnoreIfNotPresent": "false",
              "anchorUnits": "pixels",
              "documentId": "2"
            }
          ]
        }
        return prev
      } , {})
  })
  return tabs
}

const docusignControllers = {
  authPrompt: (req, res) => {
    ///////////////////////////////
    // 1. prompt user to sign in //
    ///////////////////////////////
    const authURL = `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature&client_id=${process.env.DOCUSIGN_CLIENT_ID}&state=${process.env.DOCUSIGN_SUPER_SECRET_STATE}&redirect_uri=${process.env.DOCUSIGN_AUTH_REDIRECT_URL}`
  
    res.redirect(authURL)
  },
  authCallback: async (req, res) => {
    console.log('2) Docusign authCallback running')
    if (req.query && req.query.code) {
      req.session.docusign = {}

      try {
        ////////////////////////
        // 2. get oAuth token //
        ////////////////////////
        const idPass64 = Buffer
          .from(`${process.env.DOCUSIGN_CLIENT_ID}:${process.env.DOCUSIGN_CLIENT_SECRET}`)
          .toString('base64') 
  
        let headers = { 
          headers: { 
            'Authorization': `Basic ${idPass64}` 
          },
        }
  
        const body = {
          grant_type: 'authorization_code',
          code: req.query.code
        }
  
        const { data: tokenInfo } = await axios.post(`https://account-d.docusign.com/oauth/token`, body, headers)
        const { token_type, access_token, refresh_token } = tokenInfo  
        console.log('Tokens received!', tokenInfo)
        
        req.session.docusign.tokenInfo = tokenInfo
  
        /////////////////////
        // 3. get userinfo //
        /////////////////////
        headers = {
          headers: {
            'Authorization': `${token_type} ${access_token}` 
          }
        }
  
        req.session.docusign.headers = headers.headers

        const { data: userInfo } = await axios('https://account-d.docusign.com/oauth/userinfo', headers)
        
        console.log('UserInfo: ', userInfo)
        req.session.docusign.userInfo = userInfo
  
        /////////////////////////////////////////////
        // 4. finally can make API calls, phew! :D //
        /////////////////////////////////////////////
        const account = userInfo.accounts.find(({ account_id }) => account_id === process.env.DOCUSIGN_ACCOUNT_ID)
        console.log("Account: ", account)

        const { account_id, base_uri } = account
        const apiBaseURL = `${base_uri}/restapi/v2.1/accounts/${account_id}`
        
        req.session.docusign.account = account
        req.session.docusign.apiBaseURL = apiBaseURL

        res.status(200).redirect('/')
      } catch (err) {
        console.log(err)
        res.status(500).end()
      }
    } else {
      res.status(401).send('401 Not Authorized')
    }
  },
  createEnvelope: async (req, res) => {
    console.log('createEnvelope...')
    res.status(200).send()
    ////////////////////////////////////
    // Let's try creating an envelope //
    // with a signable html doc !!!!! //
    ////////////////////////////////////
    // var contentHtml = fs.readFileSync('./doc.html', 'utf8');
    
    // // CREATE ENVELOPE
    // const signers = [
    //   {
    //     name: "Zylo",
    //     email: "zylo.codes@gmail.com",
    //     clientUserId: "zylo.codes@gmail.com",
    //     recipientId: "1",
    //     routingOrder: "1"
    //   },
    //   {
    //     name: "Jeorsh",
    //     email: "joshnaylor88@gmail.com",
    //     clientUserId: "joshnaylor88@gmail.com",
    //     recipientId: "2",
    //     routingOrder: "1"
    //   },
    //   {
    //     name: "8cto",
    //     email: "8ctopotamus@gmail.com",
    //     clientUserId: "8ctopotamus@gmail.com",
    //     recipientId: "100",
    //     routingOrder: "1"
    //   },
    // ]

    // const envBody = {
    //   recipients: {
    //     signers,
    //   },
    //   status: "created",
    //   emailSubject: "Auto-tag Me!",
    //   emailBlurb: 'Autotag test',
    //   documents: [
    //     {
    //       htmlDefinition: {
    //         source: '<h1>COVER PAGE</h1><p>Ignore me...</p>'
    //       },
    //       documentId: "1",
    //       name: "doc1.html"
    //     }
    //   ]
    // }
    
    // const { data: envelope } = await axios.post(`${apiBaseURL}/envelopes`, envBody, headers)
    // console.log('NEW Envelope', envelope)
    
    // // UPLOAD NEW DOC HTML
    // const envelopeId = envelope.envelopeId
    
    // const { data: updatedDoc } = await axios.put(
    //   `${apiBaseURL}/envelopes/${envelopeId}/documents`, 
    //   {
    //     documents: [
    //       {
    //         htmlDefinition: {
    //           source: contentHtml,
    //         },
    //         documentId: "2",
    //         name: "doc02.html"
    //       }
    //     ]
    //   }, 
    //   headers
    // )
    // console.log('updatedDoc')
    // console.log(updatedDoc)

    // // ADD RECIPIENT TABS
    // const tabs = createTabs(signers, contentHtml)      
    // for (const signer of signers) {
    //   const { recipientId } = signer
    //   const { data: updatedRecipientTabs } = await axios.post(
    //     `${apiBaseURL}/envelopes/${envelopeId}/recipients/${recipientId}/tabs`, 
    //     tabs[recipientId], 
    //     headers
    //   )
    //   console.log('updatedRecipientTabs', JSON.stringify(updatedRecipientTabs, null, 2))
    // }
    // console.log('done')
  }
}

module.exports = docusignControllers