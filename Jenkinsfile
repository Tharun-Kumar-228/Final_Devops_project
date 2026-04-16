pipeline {
    agent any

    environment {
        // Defines the Node.js path if needed, 
        // assumes "node" tool is globally configured in Jenkins setup under Global Tools Configurations
        NODEJS_HOME = tool name: 'NodeJS', type: 'jenkins.plugins.nodejs.tools.NodeJSInstallation'
        PATH = "${NODEJS_HOME}/bin:${env.PATH}"
    }

    stages {
        stage('Checkout') {
            steps {
                // Checkout code from branch
                checkout scm
            }
        }
        
        stage('Install Dependencies') {
            steps {
                // Install exactly those dependencies tracked in package.json
                sh 'npm install'
            }
        }

        stage('Run Server and Tests') {
            steps {
                script {
                    try {
                        // We must start the Node.js server in the background and pipe output
                        // 'nohup' keeps it running, and '&' backgrounds it
                        sh 'nohup node server.js > server.log 2>&1 &'
                        
                        // Give it enough time to fully launch the HTTP/WebSockets service
                        sleep time: 5, unit: 'SECONDS'
                        
                        // Execute the full integration test script
                        // Standard output will inherently be attached to the Jenkins build console!
                        sh 'npm test'
                    } finally {
                        // Guaranteed Cleanup task: Terminate the backgrounded Node application
                        // Important so subsequent builds don't hit "EADDRINUSE" port errors
                        sh 'pkill -f "node server.js" || true'
                        
                        // Print any critical server-side logs to debug potential errors
                        sh 'cat server.log || true'
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo "CI/CD Pipeline finished execution with result: ${currentBuild.currentResult}"
        }
        success {
            echo "All tests passed successfully!"
        }
        failure {
            echo "Build failed. Investigate the test results in the console output above."
        }
    }
}
