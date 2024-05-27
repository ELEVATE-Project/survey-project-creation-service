/**
 * name : generics/cloud-services.js
 * author : Ankit Shahu
 * created-date : 22-May-2024
 * Description : cloud services helpers methods.
 */

// Dependencies
const common = require('@constants/common')
const { cloudClient } = require('@configs/cloud-service')

module.exports = class FilesHelper {
	static async getSignedUrl(bucketName, destFilePath, actionType = common.WRITE_ACCESS, expiryTime = '') {
		try {
			if (['azure', 'gcloud'].includes(process.env.CLOUD_STORAGE_PROVIDER)) {
				expiryTime = Math.floor(expiryTime / 60)
			}
			const signedUrl = await cloudClient.getSignedUrl(
				bucketName, //BucketName
				destFilePath, //FilePath
				expiryTime, //Expiry
				actionType //Read[r] or Write[w]
			)

			return {
				signedUrl: process.env.CLOUD_STORAGE_PROVIDER == 'gcloud' ? signedUrl[0] : signedUrl,
				filePath: destFilePath,
				destFilePath,
			}
		} catch (error) {
			throw error
		}
	}
}
