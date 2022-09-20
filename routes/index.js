const router = require('express').Router()
const docusignRoutes = require('./docusign')
const viewControllers = require('../controllers/views')

router.use('/docusign', docusignRoutes)
router.use('*', viewControllers.home)

module.exports = router