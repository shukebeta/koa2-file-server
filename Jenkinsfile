pipeline {
  agent { label 'centos7' }
  options {
    disableConcurrentBuilds()
  }
  environment {
    PUBLISH_PATH="/home/yangtao/publish/${env.BRANCH_NAME}"
    BRANCH="${env.BRANCH_NAME}"
  }
  triggers { pollSCM('H/10 * * * *') }

  stages {
    stage('Configure') {
      when {
         branch "${BRANCH}"
      }
      steps {
        configFileProvider(
           [
             configFile(fileId: "files-env-${BRANCH}", targetLocation: ".env")
           ]
        ) {
            sshPublisher(
                continueOnError: false, failOnError: true,
                publishers: [
                 sshPublisherDesc(
                  configName: "yt-files-${BRANCH}",
                  verbose: true,
                  transfers: [
                   sshTransfer(
                    sourceFiles: "**/**",
                    remoteDirectory: "./publish/fileserver/${BRANCH}",
                    removePrefix: '',
                    remoteDirectorySDF: false,
                    cleanRemote: true,
                    execCommand: "cd ./publish/fileserver/${BRANCH} && bash deploy.sh ${BRANCH}"
                   )
                  ])
                ]
            )
         }
      }
    }
  }
}
