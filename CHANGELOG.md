## [1.10.1](https://github.com/auditmos/saas-on-cf/compare/v1.10.0...v1.10.1) (2026-07-22)


### Bug Fixes

* **data-ops:** set explicit rootDir for tsc-alias 1.9 ([b182d34](https://github.com/auditmos/saas-on-cf/commit/b182d3401b841ed886fc753c9441dc820753fb11))

# [1.10.0](https://github.com/auditmos/saas-on-cf/compare/v1.9.2...v1.10.0) (2026-05-25)


### Features

* **init-project:** wire wrangler route placeholders from prompts ([#26](https://github.com/auditmos/saas-on-cf/issues/26)) ([191f624](https://github.com/auditmos/saas-on-cf/commit/191f624a91f6175ce7cb753bf1c50d66b1347da9))

## [1.9.2](https://github.com/auditmos/saas-on-cf/compare/v1.9.1...v1.9.2) (2026-05-25)


### Bug Fixes

* **rate-limit:** drop from /health/ready, apply to /clients mutations ([#23](https://github.com/auditmos/saas-on-cf/issues/23)) ([48adf22](https://github.com/auditmos/saas-on-cf/commit/48adf222694fa0a30c68d615f9349077f2c65225))

## [1.9.1](https://github.com/auditmos/saas-on-cf/compare/v1.9.0...v1.9.1) (2026-05-25)


### Bug Fixes

* **config:** declare CLOUDFLARE_ENV in wrangler.jsonc vars per env block ([abf0a95](https://github.com/auditmos/saas-on-cf/commit/abf0a95cc6b5d62404dea00303e8298347967f4c))

# [1.9.0](https://github.com/auditmos/saas-on-cf/compare/v1.8.12...v1.9.0) (2026-05-25)


### Features

* **security:** add defense-in-depth headers to both Workers ([#20](https://github.com/auditmos/saas-on-cf/issues/20)) ([0fbb0e3](https://github.com/auditmos/saas-on-cf/commit/0fbb0e3f8581e5162ca2cb3345452dcfaecff095))

## [1.8.12](https://github.com/auditmos/saas-on-cf/compare/v1.8.11...v1.8.12) (2026-05-25)

## [1.8.11](https://github.com/auditmos/saas-on-cf/compare/v1.8.10...v1.8.11) (2026-05-25)


### Bug Fixes

* **security:** validate x-request-id to prevent log injection ([#18](https://github.com/auditmos/saas-on-cf/issues/18)) ([456d460](https://github.com/auditmos/saas-on-cf/commit/456d460331ba6567e348a9c28e86c3c6aca0d068))

## [1.8.10](https://github.com/auditmos/saas-on-cf/compare/v1.8.9...v1.8.10) (2026-05-25)


### Performance Improvements

* **cors:** cache cors() factory per env + drop stale :5173 origins ([14bcac6](https://github.com/auditmos/saas-on-cf/commit/14bcac6989debb6c845459a2cfd18bedb3aff40c)), closes [#17](https://github.com/auditmos/saas-on-cf/issues/17)

## [1.8.9](https://github.com/auditmos/saas-on-cf/compare/v1.8.8...v1.8.9) (2026-05-25)


### Bug Fixes

* **security:** replace Math.random() with crypto in example workflow ([85cdea7](https://github.com/auditmos/saas-on-cf/commit/85cdea76a4e84fa4036ff3013906dc0f28dcb4d7)), closes [#16](https://github.com/auditmos/saas-on-cf/issues/16)

## [1.8.8](https://github.com/auditmos/saas-on-cf/compare/v1.8.7...v1.8.8) (2026-05-25)


### Bug Fixes

* **auth:** forward all HTTP methods to Better Auth via ANY handler ([391eaaa](https://github.com/auditmos/saas-on-cf/commit/391eaaa5488e7ea7c7236c9e4a9df453f3b78a5a)), closes [#15](https://github.com/auditmos/saas-on-cf/issues/15)

## [1.8.7](https://github.com/auditmos/saas-on-cf/compare/v1.8.6...v1.8.7) (2026-05-25)


### Bug Fixes

* **auth:** make setAuth idempotent to avoid per-request reinit ([5dabd20](https://github.com/auditmos/saas-on-cf/commit/5dabd20c6a3f367c1ac9b359f23d5200bbcae56e))

## [1.8.6](https://github.com/auditmos/saas-on-cf/compare/v1.8.5...v1.8.6) (2026-05-25)


### Bug Fixes

* **workers:** add explicit observability sampling rates and shape test ([c25c55f](https://github.com/auditmos/saas-on-cf/commit/c25c55fea3a4d9a02f668f98a9fada0bf93b4833)), closes [#13](https://github.com/auditmos/saas-on-cf/issues/13)

## [1.8.5](https://github.com/auditmos/saas-on-cf/compare/v1.8.4...v1.8.5) (2026-05-25)


### Bug Fixes

* **workers:** bump stale compatibility_date and add freshness test ([031b4c3](https://github.com/auditmos/saas-on-cf/commit/031b4c312f10926ca9cd83a50f8d5c8ef1f34f6f)), closes [#12](https://github.com/auditmos/saas-on-cf/issues/12)

## [1.8.4](https://github.com/auditmos/saas-on-cf/compare/v1.8.3...v1.8.4) (2026-05-25)


### Bug Fixes

* **types:** correct service-bindings typo and type implicit-any payloads ([d67c799](https://github.com/auditmos/saas-on-cf/commit/d67c799d4d4beb2773ed6fe390d37a5911d62b9d)), closes [#11](https://github.com/auditmos/saas-on-cf/issues/11)

## [1.8.3](https://github.com/auditmos/saas-on-cf/compare/v1.8.2...v1.8.3) (2026-05-24)


### Bug Fixes

* **security:** stop shipping data-service bearer to browser ([#10](https://github.com/auditmos/saas-on-cf/issues/10)) ([c3ed908](https://github.com/auditmos/saas-on-cf/commit/c3ed9088bd8d7ee1caf0987fe00635df9e7c196b))

## [1.8.2](https://github.com/auditmos/saas-on-cf/compare/v1.8.1...v1.8.2) (2026-05-24)


### Bug Fixes

* **security:** replace module-level rate limiter with platform ratelimit binding ([5a0976e](https://github.com/auditmos/saas-on-cf/commit/5a0976e0af37a7be960a8d3d7c556bac8af66095)), closes [#9](https://github.com/auditmos/saas-on-cf/issues/9)

## [1.8.1](https://github.com/auditmos/saas-on-cf/compare/v1.8.0...v1.8.1) (2026-05-05)

# [1.8.0](https://github.com/auditmos/saas-on-cf/compare/v1.7.0...v1.8.0) (2026-05-05)


### Features

* CI/CD pipeline + test-harness (back-port from pi-web) ([560e66e](https://github.com/auditmos/saas-on-cf/commit/560e66ec8054fae8fd2d914a480a0b09b3045340))

# [1.7.0](https://github.com/auditmos/saas-on-cf/compare/v1.6.0...v1.7.0) (2026-03-16)


### Features

* add brainstormer plugin as submodule with skill symlinks ([7780a7a](https://github.com/auditmos/saas-on-cf/commit/7780a7a894744b3d301c4f503de1e18684afb34a))

# [1.6.0](https://github.com/auditmos/saas-on-cf/compare/v1.5.0...v1.6.0) (2026-03-16)


### Features

* adopt AGENTS.md convention with CLAUDE.md symlinks and add llms.txt ([fcb6dca](https://github.com/auditmos/saas-on-cf/commit/fcb6dca4e98d4f7b45ea54b5423d092028be3034))

# [1.5.0](https://github.com/auditmos/saas-on-cf/compare/v1.4.0...v1.5.0) (2026-03-16)


### Features

* expand bug fix workflow to full TDD cycle in rules ([8ca5d0e](https://github.com/auditmos/saas-on-cf/commit/8ca5d0ecc4d10d86321b8566b4afa22f754dd569))

# [1.4.0](https://github.com/auditmos/saas-on-cf/compare/v1.3.0...v1.4.0) (2026-03-16)


### Features

* add vitest test infrastructure and Claude Code hooks ([136b624](https://github.com/auditmos/saas-on-cf/commit/136b6247f2ea1a6900c5bd9c5345dee79bf1759d))

# [1.3.0](https://github.com/auditmos/saas-on-cf/compare/v1.2.0...v1.3.0) (2026-03-15)


### Features

* update dependencies, fix better-auth 1.5.5 type break ([6366f79](https://github.com/auditmos/saas-on-cf/commit/6366f7906f3879a171d5ff25a5ec95b24c993506))

# [1.2.0](https://github.com/auditmos/saas-on-cf/compare/v1.1.0...v1.2.0) (2026-03-15)


### Features

* add taze for dependency update checking ([57c243c](https://github.com/auditmos/saas-on-cf/commit/57c243c79a6e680efb6c99fc79b4d161535a944c))

# [1.1.0](https://github.com/auditmos/saas-on-cf/compare/v1.0.0...v1.1.0) (2026-03-15)


### Features

* add knip and remove unused code/dependencies ([c00825f](https://github.com/auditmos/saas-on-cf/commit/c00825fe92a6c8e6102403cfff37357a2a6953a3))

# 1.0.0 (2026-03-15)


### Features

* add semantic-release and fix all lint/type errors ([a288e57](https://github.com/auditmos/saas-on-cf/commit/a288e57b2dfdfdbc3452b6f3de1f07feb8033dac))
