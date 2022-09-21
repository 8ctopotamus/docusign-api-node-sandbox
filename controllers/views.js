const viewControllers = {
  home: (req, res) => {
    const { status, message } = req.query

    let data = {
      notification: {
        status, 
        message,
      },
      authenticated: false,
    }
    
    if (req?.session?.docusign) {
      const { 
        userInfo, 
        account: { 
          account_name 
        },
      } = req.session.docusign

      data = {
        ...data,
        authenticated: true,
        account_name,
        ...userInfo,
      }
    }
    
    res.render('home', data)
  },
  embeddedSigning: (req, res) => {
    // res.render('embeddedSigning', { 
    //   signerURLs: req.session.docusign.signerURLs, 
    // })
    res.render('embeddedSigning')
  }
}

module.exports = viewControllers