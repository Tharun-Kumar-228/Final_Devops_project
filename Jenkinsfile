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
                    // The Node application runs inside Docker.
                    // This leverages `docker exec` to natively validate the API.
                    // If tests fail, the build halts. If they pass, the container continuously runs for Production!
                    sh 'docker exec taskcode-server npm test'
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
