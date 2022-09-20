const viewControllers = {
  home: (req, res) => {
    let data = {
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
  }
}

module.exports = viewControllers