pipeline {
    agent any

    stages {
        stage('Clone Repository') {
            steps {
                // Jenkins automatically pulls the latest master from GitHub Hook execution
                checkout scm
            }
        }
        
        stage('Build Docker Image') {
            steps {
                // Build an isolated, containerized architecture tracking the Dockerfile
                sh 'docker build -t taskcode-app:latest .'
            }
        }

        stage('Deploy Sandbox Container') {
            steps {
                script {
                    // Preemptively purge any ghost containers that might collision on Port 3000
                    sh 'docker rm -f taskcode-server || true'
                    
                    // Instantiate container completely detached from the Pipeline thread
                    sh 'docker run -d -p 3000:3000 --name taskcode-server taskcode-app:latest'
                    
                    // Allow backend network logic sufficient time to mount localhost hooks
                    sleep time: 5, unit: 'SECONDS'
                    
                    // Emit docker startup logs verifying the listener spawned successfully
                    sh 'docker logs taskcode-server'
                }
            }
        }

        stage('Execute Integration Tests') {
            steps {
                script {
                    try {
                        // The Node application runs inside Docker exclusively. No NodeJS on Jenkins is required!
                        // This leverages `docker exec` to internally parse and validate the API inside the container framework.
                        sh 'docker exec taskcode-server npm test'
                    } finally {
                        // Crucial TEARDOWN phase guarantees we strictly dispose of sandbox instances
                        sh 'docker stop taskcode-server || true'
                        sh 'docker rm taskcode-server || true'
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo "CI Pipeline Execution finished definitively with result: ${currentBuild.currentResult}"
        }
        success {
            echo "Container successfully compiled and fully validated via internal Node automated testing suite."
        }
        failure {
            echo "A build phase failed... Ensure Docker permissions are granted on the VM runner, and cross-reference Jenkins Console Outputs via the failed test."
        }
    }
}
