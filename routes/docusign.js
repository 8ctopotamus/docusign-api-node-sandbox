const router = require('express').Router()
const { authPrompt, authCallback } = require('../controllers/docusign')

router.get('/signin', authPrompt)
router.get('/authorization-code/callback', authCallback)

module.exports = router