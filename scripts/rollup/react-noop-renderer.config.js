import { getPackageJson, resolvePkgPath, getBaseRollupPlugins } from './utils'
import rollupPluginGeneratePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { name, module, peerDependencies } = getPackageJson('react-noop-renderer')
// react-noop-renderer包的路径
const pkgPath = resolvePkgPath(name)
// react-noop-renderer产物的路径
const pkgDistPath = resolvePkgPath(name, true)

export default [
	// react-noop-renderer
	{
		input: `${pkgPath}/${module}`,
		output: [
			{
				file: `${pkgDistPath}/index.js`,
				name: 'ReactNoopRenderer',
				format: 'umd'
			}
		],
		external: [...Object.keys(peerDependencies), 'scheduler'],
		plugins: [
			// 兼容esModule
			...getBaseRollupPlugins({
				typescript: {
					exclude: ['./packages/react-dom/**/*'],
					tsconfigOverride: {
						compilerOptions: {
							paths: {
								hostConfig: [`./${name}/src/hostConfig.ts`]
							}
						}
					}
				}
			}),
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
