const router = require('express').Router()
const { home, embeddedSigning } = require('../controllers/views')

router.get('/embeddedSigning', embeddedSigning)
router.get('*', home)

module.exports = router