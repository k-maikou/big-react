import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils'
import rollupPluginGeneratePackageJson from 'rollup-plugin-generate-package-json'

const { name, module } = getPackageJson('react')
// react包的路径
const pkgPath = resolvePkgPath(name)
// react产物的路径
const pkgDistPath = resolvePkgPath(name, true)

console.log({
	filename: `${pkgDistPath}/jsx-runtime.js`,
	name: 'jsx-runtime.js',
	format: 'umd'
})

export default [
	// 第一个包
	{
		input: `${pkgPath}/${module}`,
		output: {
			file: `${pkgDistPath}/index.js`,
			name: 'index.js',
			format: 'umd'
		},
		plugins: [
			// 兼容esModule
			...getBaseRollupPlugins(),
			// 生成package.json
			rollupPluginGeneratePackageJson({
				inputFolder: pkgPath,
				outputFolder: pkgDistPath,
				baseContents: ({ name, description, version }) => ({
					version,
					name,
					main: 'index.js',
					description
				})
			})
		]
	},
	{
		input: `${pkgPath}/src/jsx.ts`,
		output: [
			// jsx-runtime
			{
				file: `${pkgDistPath}/jsx-runtime.js`,
				name: 'jsx-runtime.js',
				format: 'umd'
			},
			// jsx-dev-runtime
			{
				file: `${pkgDistPath}/jsx-dev-runtime.js`,
				name: 'jsx-dev-runtime.js',
				format: 'umd'
			}
		],
		plugins: getBaseRollupPlugins()
	}
]
