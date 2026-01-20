import { dest, src, parallel } from 'gulp'

function copyEmailTemplates() {
    return src(['src/enterprise/emails/*.hbs']).pipe(dest('dist/enterprise/emails'))
}

function copyEmailsFolder() {
    return src(['src/emails/**/*']).pipe(dest('dist/emails'))
}

exports.default = parallel(copyEmailTemplates, copyEmailsFolder)
