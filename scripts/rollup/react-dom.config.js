import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils'
import rollupPluginGeneratePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { name, module, peerDependencies } = getPackageJson('react-dom')
// react-dom包的路径
const pkgPath = resolvePkgPath(name)
// react-dom产物的路径
const pkgDistPath = resolvePkgPath(name, true)

export default [
	// react-dom
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'ReactDom',
				format: 'umd'
			},
			{
				file: `${pkgDistPath}/client.js`,
				name: 'client',
				format: 'umd'
			}
		],
		external: [...Object.keys(peerDependencies)],
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
	},
	// react-test-utils
	{
		input: `${pkgPath}/test-utils.ts`,
		output: [
			{
				file: `${pkgDistPath}/test-utils.js`,
				name: 'testUtils',
				format: 'umd'
			}
		],
		external: ['react-dom', 'react'],
		plugins: getBaseRollupPlugins()
	}
]
