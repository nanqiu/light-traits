/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Irakli Gozalishvili <rfobic@gmail.com> (Original author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
'use strict'

// shortcuts
var _getOwnPropertyNames = Object.getOwnPropertyNames
,   _getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor
,   _defineProperty = Object.defineProperty
,   _create = Object.create
,   _freeze = Object.freeze
,   _prototype = Object.prototype
,   _hasOwn = Object.prototype.hasOwnProperty
,   _toString = Object.prototype.toString
,   _forEach = Array.prototype.forEach
,   _slice = Array.prototype.slice
// constants
,   ERR_CONFLICT = 'Remaining conflicting property: '
,   ERR_REQUIRED = 'Missing required property: '

/**
 * Compares two trait custom property descriptors if they are the same. If
 * both are `conflict` or all the properties of descriptor are equal returned
 * value will be `true`, otherwise it will be `false`.
 * @param {Object} actual
 * @param {Object} expected
 */
function areSame(actual, expected) {
  return (actual.conflict && expected.conflict ) ||
  (   actual.get === expected.get
  &&  actual.set === expected.set
  &&  actual.value === expected.value
  &&  (true !== actual.enumerable) === (true !== expected.enumerable)
  &&  (true !== actual.required) === (true !== expected.required)
  &&  (true !== actual.conflict) === (true !== expected.conflict)
  )
}
/**
 * Converts array to an object whose own property names represent
 * values of array.
 * @param {String[]} names
 * @returns {Object}
 * @example
 *  Map(['foo', ...]) => { foo: true, ...}
 */
function Map(names) {
  var map = {}
  names.forEach(function(name) { map[name] = true })
  return map
}
/**
 * Generates custom **required** property descriptor. Descriptor contains
 * non-standard property `required` that is equal to `true`.
 * @param {String} name
 *    property name to generate descriptor for.
 * @returns {Object}
 *    custom property descriptor
 */
function Required(name) {
  function required() { throw new Error(ERR_REQUIRED + '`' + name + '`') }
  return (
  { get: required
  , set: required
  , required: true
  })
}
/**
 * Generates custom **conflicting** property descriptor. Descriptor contains
 * non-standard property `conflict` that is equal to `true`.
 * @param {String} name
 *    property name to generate descriptor for.
 * @returns {Object}
 *    custom property descriptor
 */
function Conflict(name) {
  function conflict() { throw new Error(ERR_CONFLICT + '`' + name + '`') }
  return (
  { get: conflict
  , set: conflict
  , conflict: true
  })
}
/**
 * Composes new trait with the same own properties as the original trait,
 * except that all property names appearing in the first argument are replaced
 * by 'required' property descriptors.
 * @param {String[]} keys
 *    Array of strings property names.
 * @param {Object} trait
 *    A trait some properties of which should be excluded.
 * @returns {Object}
 * @example
 *    var newTrait = exclude(['name', ...], trait)
 */
function exclude(keys, trait) {
  var exclusions = Map(keys)
  ,   result = {}
  ,   keys = _getOwnPropertyNames(trait)
  keys.forEach(function(key) {
    if (!_hasOwn.call(exclusions, key) || trait[key].required)
      result[key] = trait[key]
    else
      result[key] = Required(key)
  })
  return result
}
/**
 * Composes a new trait with the same properties as the original trait, except
 * that all properties whose name is an own property of map will be renamed to
 * map[name], and a 'required' property for name will be added instead.
 * @param {Object} map
 *    An object whose own properties serve as a mapping from old names to new
 *    names.
 * @param {Object} trait
 *    A trait object
 * @returns {Object}
 * @example
 *    var newTrait = rename(map, trait)
 */
function rename(map, trait) {
  var result = _create(Trait.prototype, {}),
      keys = _getOwnPropertyNames(trait)
  keys.forEach(function(key) {
    // must be renamed & it's not requirement
    if (_hasOwn.call(map, key) && !trait[key].required) {
      var alias = map[key]
      if (_hasOwn.call(result, alias) && !result[alias].required)
        result[alias] = Conflict(alias)
      else
        result[alias] = trait[key]
      if (!_hasOwn.call(result, key))
        result[key] = Required(key)
    } else { // must not be renamed or its a requirement
      // property is not in result trait yet
      if (!_hasOwn.call(result, key))
        result[key] = trait[key]
      // property is already in resulted trait & it's not requirement
      else if (!trait[key].required)
        result[key] = Conflict(key)
    }
  })
  return result
}
/**
 * Function generates custom properties descriptor of the `object`s own
 * properties. All the inherited properties are going to be ignored.
 * Properties with values matching `required` singleton will be marked as
 * 'required' properties.
 * @param {Object} object
 *    Set of properties to generate trait from.
 * @returns {Object}
 *    Properties descriptor of all of the `object`'s own properties.
 */
function toTrait(properties) {
  if (properties instanceof Trait) return properties
  var trait = _create(Trait.prototype)
  ,   keys = _getOwnPropertyNames(properties)
  keys.forEach(function(key) {
    var descriptor = _getOwnPropertyDescriptor(properties, key)
    trait[key] = (required === descriptor.value) ? Required(key) : descriptor
  })
  return trait
}

function compose(trait1, trait2/*, ...*/) {
  var result = _create(Trait.prototype)
  _forEach.call(arguments, function(trait) {
    if (!trait) return
    trait = trait instanceof Trait ? trait : toTrait(Object.create({}, trait))
    _getOwnPropertyNames(trait).forEach(function(key) {
      var descriptor = trait[key]
      // if property already exists and it's not a requirement
      if (_hasOwn.call(result, key) && !result[key].required) {
        if (descriptor.required) return
        if (!areSame(descriptor, result[key])) result[key] = Conflict(key)
      } else {
        result[key] = descriptor
      }
    })
  })
  return result
}
/**
 * Composes new trait. If two or more traits have own properties with the
 * same name, the new trait will contain a 'conflict' property for that name.
 * 'compose' is a commutative and associative operation, and the order of its
 * arguments is not significant.
 *
 * @params {Object} trait
 *    Takes traits as an arguments
 * @returns {Object}
 *    New trait containing the combined own properties of all the traits.
 * @example
 *    var newTrait = compose(trait_1, trait_2, ..., trait_N)
 */
function Trait(trait1, trait2) {
  return undefined === trait2 ? toTrait(trait1) : compose.apply(null, arguments)
}
var TraitProto = Trait.prototype = _create(Trait.prototype,
{ toString: { value: function toString() {
    return '[object ' + this.constructor.name + ']'
  }}
  /**
   * `create` is like `Object.create`, except that it ensures that:
   *    - an exception is thrown if 'trait' still contains required properties
   *    - an exception is thrown if 'trait' still contains conflicting
   *      properties
   * @param {Object}
   *    prototype of the compared object
   * @param {Object} trait
   *    trait object to be turned into a compare object
   * @returns {Object}
   *    An object with all of the properties described by the trait.
   */
, create: { value: function create(proto) {
    var properties = {}
    ,   keys = _getOwnPropertyNames(this)
    if (undefined === proto) proto = _prototype
    if (proto) {
      if ('' + proto.toString == '' + _toString) {
        _defineProperty(proto, 'toString',  {
          value: TraitProto.toString
        })
      }
      if ('' + proto.constructor == '' + Object) {
        _defineProperty(proto, 'constructor', {
          value: Trait.prototype.constructor
        })
      }
    }
    keys.forEach(function(key) {
      var descriptor = this[key]
      if (descriptor.required) {
        if (_hasOwn.call(proto, key))
          return properties[key] = _getOwnPropertyDescriptor(proto, key)
        else throw new Error(ERR_REQUIRED + '`' + key + '`')
      } else if (descriptor.conflict) {
        throw new Error(ERR_CONFLICT + '`' + key + '`')
      } else {
        properties[key] = descriptor
      }
    }, this)
    return _create(proto, properties)
  }, enumerable: true }
  /**
   * Composes new resolved trait, with all the same properties as the original
   * trait, except that all properties whose name is an own property of
   * resolutions will be renamed to `resolutions[name]`. If it is
   * `resolutions[name]` is `null` value is changed into a required property
   * descriptor.
   * function can be implemented as `rename(map,exclude(exclusions, trait))`
   * where map is the subset of mappings from oldName to newName and exclusions
   * is an array of all the keys that map to `null`.
   * Note: it's important to **first** `exclude`, **then** `rename`, since
   * `exclude` and rename are not associative.
   * @param {Object} resolutions
   *   An object whose own properties serve as a mapping from old names to new
   *   names, or to `null` if the property should be excluded.
   * @param {Object} trait
   *   A trait object
   * @returns {Object}
   *   Resolved trait with the same own properties as the original trait.
   */
, resolve: { value: function resolve(resolutions) {
    var renames = {},
        exclusions = [],
        keys = _getOwnPropertyNames(resolutions)
    keys.forEach(function(key) {  // pre-process renamed and excluded properties
      if (resolutions[key])       // old name -> new name
        renames[key] = resolutions[key]
      else                        // name -> undefined
        exclusions.push(key)
    })
    return rename(renames, exclude(exclusions, this))
  }, enumerable: true }
  /**
   * Composes a new trait with all of the combined properties of the argument
   * traits. In contrast to `compose`, `override` immediately resolves all
   * conflicts resulting from this composition by overriding the properties of
   * later traits. Trait priority is from left to right. I.e. the properties of
   * the leftmost trait are never overridden.
   * @params {Object} trait
   * @returns {Object}
   * @examples
   *    // override is associative:
   *    override(t1,t2,t3)
   *    // is equivalent to
   *    override(t1, override(t2, t3))
   *    // or
   *    to override(override(t1, t2), t3)
   *
   *    // override is not commutative:
   *    override(t1,t2)
   *    // is not equivalent to
   *    override(t2,t1)
   */
, override: { value: function override() {
    var traits = _slice.call(arguments, 0).map(toTrait),
        result = _create(TraitProto)
    traits.unshift(this)
    traits.forEach(function(trait) {
      var keys = _getOwnPropertyNames(trait)
      keys.forEach(function(key) {
        var descriptor = trait[key]
        if (!_hasOwn.call(result, key) || result[key].required)
          result[key] = descriptor
      })
    })
    return result
  }, enumerable: true }
})
/**
 * Constant singleton, representing placeholder for required properties.
 * @type {Object}
 */
var required = Trait.required = { toString: function() { return '<Trait.required>' } }
exports.Trait = Trait