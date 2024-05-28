/**
 * name : configs
 * author : Aman Kumar Gupta
 * Date : 31-Sep-2021
 * Description : Contains connections of all configs
 */

require('./kafka')()

require('./cache')()
const path = require('path')

global.PROJECT_ROOT_DIRECTORY = path.join(__dirname, '..')
