const router = require('express').Router()
const docusignRoutes = require('./docusign')
const viewRoutes = require('./views')

router.use('/docusign', docusignRoutes)
router.use('/', viewRoutes)

module.exports = router