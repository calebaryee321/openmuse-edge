const { withProjectBuildGradle } = require("expo/config-plugins");

const MARKER = "// OpenMuse Edge Kotlin compatibility";

module.exports = function withEdgeKotlinResolution(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language !== "groovy") {
      throw new Error("OpenMuse Edge Kotlin resolution plugin requires Groovy build.gradle");
    }

    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += `

${MARKER}
allprojects {
  configurations.configureEach {
    resolutionStrategy {
      force "org.jetbrains.kotlin:kotlin-stdlib:2.2.20"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.2.20"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.2.20"
      force "org.jetbrains.kotlin:kotlin-stdlib-common:2.2.20"
    }
  }
}
`;
    }

    return mod;
  });
};
