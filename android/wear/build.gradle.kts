plugins {
    id("com.android.application")
}

android {
    namespace = "com.jayanthan.jarvisai"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jayanthan.jarvisai.wear"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    sourceSets.getByName("main") {
        java.srcDir("../app/src/main/java")
        res.srcDir("../app/src/main/res")
        assets.srcDir("../app/src/main/assets")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
        }
    }
}
