const { withMainApplication } = require('@expo/config-plugins');

// This plugin registers the DirectSms native module in MainApplication
const withDirectSmsPackage = (config) => {
    return withMainApplication(config, async (config) => {
        let mainApplication = config.modResults.contents;

        // Add import for DirectSmsPackage if not present
        const importStatement = 'import com.sosapp.scrunchie.DirectSmsPackage;';
        if (!mainApplication.includes(importStatement)) {
            // Find the package imports section and add our import
            const lastImportIndex = mainApplication.lastIndexOf('import ');
            const endOfImportLine = mainApplication.indexOf('\n', lastImportIndex);

            if (endOfImportLine !== -1) {
                mainApplication =
                    mainApplication.slice(0, endOfImportLine + 1) +
                    importStatement + '\n' +
                    mainApplication.slice(endOfImportLine + 1);
            }
        }

        // Add the package to getPackages() method
        const packageAddition = 'packages.add(new DirectSmsPackage());';
        if (!mainApplication.includes(packageAddition)) {
            // Look for the getPackages override 
            const getPackagesRegex = /override fun getPackages\(\): List<ReactPackage> \{[\s\S]*?val packages = PackageList\(this\)\.packages/;
            const match = mainApplication.match(getPackagesRegex);

            if (match) {
                const insertPoint = mainApplication.indexOf(match[0]) + match[0].length;
                mainApplication =
                    mainApplication.slice(0, insertPoint) +
                    '\n            ' + packageAddition +
                    mainApplication.slice(insertPoint);
            } else {
                // Try Java syntax
                const javaGetPackagesRegex = /protected List<ReactPackage> getPackages\(\) \{[\s\S]*?List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\)/;
                const javaMatch = mainApplication.match(javaGetPackagesRegex);

                if (javaMatch) {
                    const insertPoint = mainApplication.indexOf(javaMatch[0]) + javaMatch[0].length;
                    mainApplication =
                        mainApplication.slice(0, insertPoint) +
                        ';\n            ' + packageAddition.replace(';', '') +
                        mainApplication.slice(insertPoint);
                }
            }
        }

        config.modResults.contents = mainApplication;
        return config;
    });
};

module.exports = withDirectSmsPackage;
