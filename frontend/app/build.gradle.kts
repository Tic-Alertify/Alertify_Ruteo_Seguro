import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    id("com.google.android.libraries.mapsplatform.secrets-gradle-plugin")
}

android {
    namespace = "com.erickballas.ruteoseguro"
    compileSdk = 35 // Updated to 35 as release(36) is likely not standard/correct here if targetSdk is 36

    defaultConfig {
        applicationId = "com.erickballas.ruteoseguro"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        val properties = Properties()
        val localPropertiesFile = project.rootProject.file("local.properties")
        if (localPropertiesFile.exists()) {
            localPropertiesFile.inputStream().use(properties::load)
        }

        val rawBaseUrl = properties.getProperty("BASE_URL")?.trim()
        val sanitizedBaseUrl = rawBaseUrl
            ?.trim('"')
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        val baseUrlLiteral = "\"${sanitizedBaseUrl ?: "http://10.0.2.2:3000/"}\""
        buildConfigField("String", "BASE_URL", baseUrlLiteral)
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    // Google Maps SDK
    implementation(libs.play.services.maps)
    implementation(libs.android.maps.utils)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.google.places)

    // Retrofit
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
}