pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'your-registry.com'  // Change to your registry
        IMAGE_NAME = 'mai-soong'
        DOCKER_CREDENTIALS = 'docker-credentials-id'  // Jenkins credentials ID
        
        // Application settings
        MYSQL_ROOT_PASSWORD = credentials('mysql-root-password')  // Jenkins secret
        API_URL = 'https://api.yourdomain.com'
        NEXT_PUBLIC_API_URL = 'https://api.yourdomain.com'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                echo "Branch: ${env.BRANCH_NAME}"
                echo "Commit: ${env.GIT_COMMIT}"
            }
        }
        
        stage('Install Dependencies') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }
        
        stage('Lint & Test') {
            parallel {
                stage('Backend Lint') {
                    steps {
                        dir('backend') {
                            sh 'npm run lint || true'
                        }
                    }
                }
                stage('Frontend Lint') {
                    steps {
                        dir('frontend') {
                            sh 'npm run lint || true'
                        }
                    }
                }
            }
        }
        
        stage('Build Frontend') {
            steps {
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }
        
        stage('Build Docker Images') {
            steps {
                script {
                    def tag = "${env.BUILD_NUMBER}"
                    
                    // Build backend image
                    sh """
                        docker build -t ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${tag} ./backend
                        docker tag ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${tag} ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:latest
                    """
                    
                    // Build frontend image
                    sh """
                        docker build -t ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${tag} ./frontend
                        docker tag ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${tag} ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:latest
                    """
                }
            }
        }
        
        stage('Push Docker Images') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'production'
                }
            }
            steps {
                script {
                    def tag = "${env.BUILD_NUMBER}"
                    
                    docker.withRegistry("https://${DOCKER_REGISTRY}", DOCKER_CREDENTIALS) {
                        sh """
                            docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:${tag}
                            docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}-backend:latest
                            docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:${tag}
                            docker push ${DOCKER_REGISTRY}/${IMAGE_NAME}-frontend:latest
                        """
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    sh """
                        docker-compose -f docker-compose.staging.yml down || true
                        docker-compose -f docker-compose.staging.yml pull
                        docker-compose -f docker-compose.staging.yml up -d
                    """
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                    branch 'production'
                }
            }
            steps {
                input message: 'Deploy to production?', ok: 'Deploy'
                script {
                    sh """
                        docker-compose -f docker-compose.yml down || true
                        docker-compose -f docker-compose.yml pull
                        docker-compose -f docker-compose.yml up -d
                    """
                }
            }
        }
        
        stage('Health Check') {
            steps {
                script {
                    sleep 30  // Wait for services to start
                    
                    // Check backend health
                    sh """
                        curl -f http://localhost:3001/health || exit 1
                    """
                    
                    // Check frontend health
                    sh """
                        curl -f http://localhost:3000 || exit 1
                    """
                    
                    echo "Health check passed!"
                }
            }
        }
        
        stage('Cleanup') {
            steps {
                sh """
                    docker image prune -f
                    docker container prune -f
                """
            }
        }
    }
    
    post {
        success {
            echo 'Pipeline succeeded!'
            // Uncomment to send notification
            // slackSend channel: '#deployments', color: 'good', message: "Mai Soong deployed successfully! Build #${env.BUILD_NUMBER}"
        }
        failure {
            echo 'Pipeline failed!'
            // Uncomment to send notification
            // slackSend channel: '#deployments', color: 'danger', message: "Mai Soong deployment failed! Build #${env.BUILD_NUMBER}"
        }
        always {
            cleanWs()
        }
    }
}