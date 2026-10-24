plugins {
    id("com.android.application")
}

val signingStoreFile = providers.environmentVariable("JARVIS_ANDROID_KEYSTORE").orNull
val signingStorePassword = providers.environmentVariable("JARVIS_ANDROID_KEYSTORE_PASSWORD").orNull
val signingKeyAlias = providers.environmentVariable("JARVIS_ANDROID_KEY_ALIAS").orNull
val signingKeyPassword = providers.environmentVariable("JARVIS_ANDROID_KEY_PASSWORD").orNull
val hasReleaseSigning = listOf(
    signingStoreFile,
    signingStorePassword,
    signingKeyAlias,
    signingKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "com.jayanthan.jarvisai"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.jayanthan.jarvisai"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                storeFile = file(signingStoreFile!!)
                storePassword = signingStorePassword
                keyAlias = signingKeyAlias
                keyPassword = signingKeyPassword
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}
