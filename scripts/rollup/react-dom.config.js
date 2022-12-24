import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils'
import rollupPluginGeneratePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { name, module } = getPackageJson('react-dom')
// react-dom包的路径
const pkgPath = resolvePkgPath(name)
// react-dom产物的路径
const pkgDistPath = resolvePkgPath(name, true)

console.log({
	filename: `${pkgDistPath}/jsx-runtime.js`,
	name: 'jsx-runtime.js',
	format: 'umd'
})

export default [
	// react-dom
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'index.js',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/client.js`,
				name: 'client.js',
				format: 'umd'
			}
		],
		plugins: [
			// 兼容esModule
			...getBaseRollupPlugins(),
			alias({
				entries: {
					hostConfig: `${pkgPath}/src/hostConfig.ts`
				}
			}),
			// 生成package.json
			rollupPluginGeneratePackageJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					version,
					name,
					peerDependencies: {
						react: version
					},
					main: 'index.js',
					description
				})
			})
		]
	}
]
