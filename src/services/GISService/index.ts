import Service from '../Service'
import {GISResult, IrismonumentProperties, MunicipalityStatistics, Statistics} from './types/Irismonument'
import { Params } from './types/Params'
import { URLSearchParams } from 'url'

const URL_BASE = 'https://gis.urban.brussels/geoserver/ows'
const DEFAULT_TYPENAME = 'BSO_DML_BESC:Inventaris_Irismonument'

class GISService extends Service {

  static ParamsBuilder = class {
    private params: Params

    constructor() {
      this.params = {
        service: 'wfs',
        version: '2.0.0',
        request: 'GetFeature',
        TypeName: DEFAULT_TYPENAME,
        outputformat: 'application/json',
        cql_filter: {},
        srsname: 'EPSG:4326'
      }
    }

    setService (service: string): this {
      this.params.service = service
      return this
    }

    setVersion (version: string): this {
      this.params.version = version
      return this
    }

    setRequest (request: string): this {
      this.params.request = request
      return this
    }

    setTypeName (typeName: string): this {
      this.params.TypeName = typeName
      return this
    }

    setOutputFormat (outFormat: string): this {
      this.params.outputformat = outFormat
      return this
    }

    setCQLFilter (cqlFilter: IrismonumentProperties): this {
      this.params.cql_filter = cqlFilter
      return this
    }

    setSRSName (name: string): this {
      this.params.srsname = name
      return this
    }

    build (strict = true): string {
      /* const tmp = new Array<string>()
      Object.entries(this.params).forEach((key, value) => {
        if (typeof value === 'string') {
          tmp.push(`${ key }=${ escape(value) }`)
        } else {
          const props = Object.entries(value)
          const conds = props.map(([key, value]): string => {
            return value ? `${ key } = '${ escape(this.addSlashes('' + value)) }'` : ''
          }).filter(s => s !== '')

          if (props.length === 0)
          {
            return;
          }

          tmp.push(
            `${ key }=${ conds.join(strict ? ' and ' : ' or ') }`
          )
        }
      })
      return '?' + tmp.join('&'); */
      const params = new URLSearchParams()
      Object.entries(this.params).forEach(([key, value]) => {
        if (typeof value === 'string') {
          params.set(key, value)
        } else {
          const props = Object.entries(value)
          const conds = props.map(([key, value]): string => {
            return value ? `${ key } = '${ escape(this.addSlashes('' + value)) }'` : ''
          }).filter(s => s !== '')

          if (props.length === 0)
          {
            return;
          }

          params.set(key, conds.join(strict ? ' and ' : ' or '))
        }
      })
      return '?' + params.toString()
    }

    addSlashes(str: string): string {
      return str.replace(/\\/g, '\\\\').
        replace(/\t/g, '\\t').
        replace(/\n/g, '\\n').
        replace(/\f/g, '\\f').
        replace(/\r/g, '\\r').
        replace(/'/g, '\\\'').
        replace(/"/g, '\\"')
    }
  }

  constructor () {
    super(URL_BASE)
  }

  getInfoByZipCode (zipCode: number | string) {
    return new Promise<GISResult>((resolve, reject) => {
      const params = new GISService.ParamsBuilder()
      params.setCQLFilter({ CITY: zipCode })

      this.axios.get<GISResult>(params.build())
        .then(({ data }) => {
          resolve(data as GISResult)
        })
        .catch((e: unknown) => {
          reject(e)
        })
    })
  }

  getInfoByFilters (filters: IrismonumentProperties, strict = true) {
    return new Promise<GISResult>((resolve, reject) => {
      const params = new GISService.ParamsBuilder()
      params.setCQLFilter(filters)
      // console.log(params.build(strict))
      this.axios.get<GISResult>(params.build(strict))
        .then(({ data }) => {
          resolve(data as GISResult)
        })
        .catch((e: unknown) => reject(e))
    })
  }

  getAll() {
    return new Promise<GISResult>((resolve, reject) => {
    const params = new GISService.ParamsBuilder()
      console.log(params.build())
      this.axios.get<GISResult>(params.build())
        .then(({ data }) => resolve(data))
        .catch(e => reject(e))
    })
  }

  getStats () {
    return new Promise<Statistics>((resolve, reject) => {
      const params = new GISService.ParamsBuilder()
      console.log(params.build())
      this.axios.get<GISResult>(params.build())
        .then(({ data }) => {
          const buildingsCount = data.totalFeatures

          // number of buildings per zip code
          const statsZIPCode = {} as {[key: string]: number}
          data.features.forEach(f => {
            if (!f.properties.CITY) {
              return;
            }

            // if the zipCode already exists, increment its count, otherwise initialise it and set it's count to 1
            if (statsZIPCode[f.properties.CITY]) {
              statsZIPCode[f.properties.CITY]++
            } else {
              statsZIPCode[f.properties.CITY] = 1
            }
          })

          // number of architectural styles per zip code
          const municipalityStatistics = {} as {[key: string]: MunicipalityStatistics}
          data.features.forEach(f => {
            if (!f.properties.CITY || !f.properties.STYLE_FR) {
              return;
            }

            if (!municipalityStatistics[f.properties.CITY]) {
              municipalityStatistics[f.properties.CITY] = {
                zipCode: '' + f.properties.CITY,
                statsCount: {}
              }
            }

            if (!municipalityStatistics[f.properties.CITY].statsCount[f.properties.STYLE_FR]) {
              municipalityStatistics[f.properties.CITY].statsCount[f.properties.STYLE_FR] = 1
            } else {
              municipalityStatistics[f.properties.CITY].statsCount[f.properties.STYLE_FR]++
            }
          })

          // number of times an architectural style is used
          const stylesCount = {} as {[key: string]: number}
          data.features.forEach(f => {
            // check if the style is filled in
            if (!f.properties.STYLE_FR) {
              return;
            }

            // if the style already exists, increment its count, otherwise initialise it and set it's count to 1
            if (stylesCount[f.properties.STYLE_FR]) {
              stylesCount[f.properties.STYLE_FR]++
            } else {
              stylesCount[f.properties.STYLE_FR] = 1
            }
          })

          // number of times someone has been an intervenant for a building
          const intervenantsBuildingsCount = {} as {[key: string]: number}
          data.features.forEach(f => {
            if (!f.properties.INTERVENANTS) {
              return;
            }

            if (f.properties.INTERVENANTS.includes(", ")) {
              // multiple intervenants
              f.properties.INTERVENANTS.toString().split(",").forEach(intervenant => {
                const currentIntervenant = intervenant.replace(/\(.*\)/,'').trimEnd().trimStart()

                // if the intervenant already exists, increment its count, otherwise initialise it and set it's count to 1
                if (intervenantsBuildingsCount[currentIntervenant]) {
                  intervenantsBuildingsCount[currentIntervenant]++
                } else {
                  intervenantsBuildingsCount[currentIntervenant] = 1
                }
              })
            } else {
              // a single intervenant
              // remove the year and whitespace from the intervenant's name
              const currentIntervenant = f.properties.INTERVENANTS.toString().replace(/\(.*\)/,'').trimEnd()

              // if the intervenant already exists, increment its count, otherwise initialise it and set it's count to 1
              if (intervenantsBuildingsCount[currentIntervenant]) {
                intervenantsBuildingsCount[currentIntervenant]++
              } else {
                intervenantsBuildingsCount[currentIntervenant] = 1
              }
            }
          })

          resolve({
            statsZIPCode,
            buildingsCount,
            municipalityStatistics,
            stylesCount,
            intervenantsBuildingsCount
          } as Statistics)
        })
        .catch((e: unknown) => reject(e))
    })
  }
}

const _default = new GISService()

export default _default
