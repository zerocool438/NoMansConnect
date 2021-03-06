import log from './log';
import state from './state';
import React from 'react';
import {assignIn, cloneDeep, orderBy, uniq, uniqBy} from 'lodash';

import * as utils from './utils';
import {handleRestart} from './dialog';
import {each, find, findIndex, filter} from './lang';

import GalacticMap from './map';
import LocationBox from './locationBox';
import StoredLocations from './storedLocations';
import RemoteLocations from './remoteLocations';

const empty = []

class Container extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      updating: false,
      edit: false,
      mapRender: '<div />'
    };
    this.connectId = state.connect({
      selectedLocation: () => {
        if (this.willUnmount || !this.state.edit) {
          return;
        }
        this.setState({edit: false})
      },
      handleFavorite: (location) => this.handleFavorite(location),
      updateLocation: (location) => this.updateLocation(location)
    })
  }
  componentWillUnmount() {
    this.willUnmount = true;
    state.disconnect(this.connectId);
  }
  handleFavorite = (location) => {
    if (this.props.s.offline) {
      state.set({error: `Unable to favorite location in offline mode.`});
      return;
    }
    let refFav = findIndex(this.props.s.favorites, (fav) => {
      return fav === location.id;
    });
    let upvote = refFav === -1;
    let {storedLocations, remoteLocations, machineId, username, favorites} = this.props.s;

    utils.ajax.post('/nmslocation/', {
      machineId: machineId,
      username: username,
      score: location.score,
      upvote: upvote,
      id: location.id
    }).then((res) => {
      res.data.data.score = res.data.score;
      res.data.data.upvote = upvote;

      let refRemoteLocation = findIndex(remoteLocations.results, (location) => {
        return location.data.id === location.id;
      });
      if (refRemoteLocation > -1) {
        assignIn(remoteLocations.results[refRemoteLocation].data, {
          score: res.data.score,
          upvote: upvote,
        });
      }
      let refLocation = findIndex(storedLocations, _location => _location.id === location.id);
      if (upvote) {
        if (refLocation > -1) {
          storedLocations[refLocation] = res.data.data;
        } else {
          storedLocations.push(res.data.data);
        }
        favorites.push(location.id);
      } else {
        favorites.splice(refFav, 1);
        if (refLocation > -1) {
          storedLocations.splice(refLocation, 1);
        }
      }
      state.set({
        storedLocations,
        remoteLocations,
        favorites: uniq(favorites)
      });
    }).catch((err) => {
      log.error(`Failed to favorite remote location: ${err}`);
    });
  }
  handleUpdate = (name, description) => {
    this.setState({updating: true}, () => {
      if (description.length > 200) {
        this.setState({limit: true});
        return;
      }
      const update = () => {
        let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
        if (refLocation !== -1) {
          this.props.s.storedLocations[refLocation].name = name;
          this.props.s.storedLocations[refLocation].description = description;
        }
        let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
          return location.data.id === this.props.s.selectedLocation.id;
        });
        if (refRemoteLocation !== -1) {
          this.props.s.remoteLocations.results[refRemoteLocation].name = name;
          this.props.s.remoteLocations.results[refRemoteLocation].data.description = description;
          this.props.s.remoteLocations.results[refRemoteLocation].description = description;
        }
        this.props.s.selectedLocation.name = name;
        this.props.s.selectedLocation.description = description;
        state.set({
          storedLocations: this.props.s.storedLocations,
          remoteLocations: this.props.s.remoteLocations,
          selectedLocation: this.props.s.selectedLocation
        }, () => {
          if (this.willUnmount) {
            return;
          }
          this.setState({
            updating: false,
            edit: false
          });
        });
      };

      if (this.props.s.offline) {
        update();
        return;
      }

      utils.ajax.post('/nmslocation/', {
        machineId: this.props.s.machineId,
        username: this.props.s.username,
        name: name,
        description: description,
        id: this.props.s.selectedLocation.id
      }).then((res) => {
        update();
      }).catch((err) => {
        log.error(`Failed to update remote location: ${err}`);
      });
    });
  }
  updateLocation = (location) => {
    utils.ajax.put(`/nmslocation/${location.id}/`, {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      data: location
    }).then((res) => {
      let {remoteLocations, storedLocations} = this.props.s;
      let stateUpdate = {};
      let refRemote = findIndex(remoteLocations.results, (location) => location.id === res.data.id);
      let refStored = findIndex(storedLocations, (location) => location.id === res.data.data.id);
      if (refRemote > -1) {
        remoteLocations.results[refRemote].data = res.data.data;
        stateUpdate.remoteLocations = remoteLocations;
      }
      if (refStored > -1) {
        storedLocations[refStored] = res.data.data;
        stateUpdate.storedLocations = storedLocations;
      }
      state.set(stateUpdate);
    })
  }
  handleUploadScreen = (e) => {
    e.persist();
    if (this.props.s.offline) {
      state.set({error: `Unable to upload screenshot in offline mode.`});
      return;
    }
    this.setState({updating: true}, () => {
      var reader = new FileReader();
      reader.onload = (e)=> {
        var sourceImage = new Image();
        sourceImage.onload = ()=> {
          var imgWidth = sourceImage.width;
          var imgHeight = sourceImage.height;
          var canvas = document.createElement("canvas");
          canvas.width = imgWidth;
          canvas.height = imgHeight;
          canvas.getContext('2d').drawImage(sourceImage, 0, 0, imgWidth, imgHeight);
          var newDataUri = canvas.toDataURL('image/jpeg', 0.75);
          if (newDataUri) {
            utils.ajax.post('/nmslocation/', {
              machineId: this.props.s.machineId,
              username: this.props.s.username,
              imageU: newDataUri,
              id: this.props.s.selectedLocation.id
            }).then((res) => {
              let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
              if (refLocation !== -1) {
                this.props.s.storedLocations[refLocation].image = res.data.image;
              }
              let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
                return location.data.id === this.props.s.selectedLocation.id;
              });
              if (refRemoteLocation !== -1) {
                this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
              }
              this.props.s.selectedLocation.image = res.data.image;
              state.set({
                storedLocations: this.props.s.storedLocations,
                remoteLocations: this.props.s.remoteLocations,
                selectedLocation: this.props.s.selectedLocation
              }, () => {
                if (this.willUnmount) {
                  return;
                }
                this.setState({
                  updating: false,
                  edit: false
                });
              });
            }).catch((err) => {
              log.error(`Failed to upload screenshot: ${err}`);
            });
          }
        };
        sourceImage.src = reader.result;
        this.screenshotRef.value = '';
      };
      reader.readAsDataURL(e.target.files[0]);
    });
  }
  handleDeleteScreen = () => {
    if (this.props.s.offline) {
      state.set({error: `Unable to delete screenshot in offline mode.`});
      return;
    }
    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      imageD: true,
      id: this.props.s.selectedLocation.id
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].image = res.data.image;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.data.id === this.props.s.selectedLocation.id;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].image = res.data.image;
      }
      this.props.s.selectedLocation.image = '';
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, () => {
        if (this.willUnmount) {
          return;
        }
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleCompatibility = () => {
    if (this.props.s.offline) {
      state.set({error: `Unable to mark compatibility in offline mode.`});
      return;
    }
    utils.ajax.post('/nmslocation/', {
      machineId: this.props.s.machineId,
      username: this.props.s.username,
      version: this.props.s.saveVersion,
      id: this.props.s.selectedLocation.id
    }).then((res) => {
      let refLocation = findIndex(this.props.s.storedLocations, location => location.id === this.props.s.selectedLocation.id);
      if (refLocation !== -1) {
        this.props.s.storedLocations[refLocation].version = res.data.version;
      }
      let refRemoteLocation = findIndex(this.props.s.remoteLocations.results, (location) => {
        return location.data.id === this.props.s.selectedLocation.id;
      });
      if (refRemoteLocation !== -1) {
        this.props.s.remoteLocations.results[refRemoteLocation].version = res.data.version;
        this.props.s.remoteLocations.results[refRemoteLocation].data.version = res.data.version;
      }
      this.props.s.selectedLocation.version = res.data.version;
      state.set({
        storedLocations: this.props.s.storedLocations,
        remoteLocations: this.props.s.remoteLocations,
        selectedLocation: this.props.s.selectedLocation
      }, () => {
        if (this.willUnmount) {
          return;
        }
        this.setState({
          updating: false,
          edit: false
        });
      });
    });
  }
  handleSelectLocation = (location) => {
    let deselected = this.props.s.selectedLocation && this.props.s.selectedLocation.id === location.id;
    let _location = null;
    if (!deselected) {
      let refRemoteLocation = find(this.props.s.remoteLocations.results, (remoteLocation) => {
        return remoteLocation.data.id === location.id;
      });
      if (refRemoteLocation) {
        refRemoteLocation.data.image = refRemoteLocation.image;
        refRemoteLocation.data.name = refRemoteLocation.name;
        refRemoteLocation.data.description = refRemoteLocation.description;
        refRemoteLocation.data.isHidden = location.isHidden;
        refRemoteLocation.data.positions = location.positions;
        refRemoteLocation.data.version = location.version;
        _location = refRemoteLocation.data;
      } else {
        log.error(`Unable to find reference remote location from stored locations cache: ${location.id} (fetching)`);
        if (this.props.s.offline) {
          _location = location;
        } else {
          utils.ajax.post('/nmsfavoritesync/', {
            machineId: state.machineId,
            username: state.username,
            locations: [location.id]
          }).then((res) => {
            _location = res.data[0].data;
            let {remoteLocations} = this.props.s;
            remoteLocations.results.push(res.data[0]);
            remoteLocations.results = uniqBy(remoteLocations.results, 'id');
            state.set({
              remoteLocations,
              remoteLength: remoteLocations.results.length,
              selectedLocation: deselected ? null : _location,
              selectedGalaxy: deselected ? 0 : _location.galaxy,
              multiSelectedLocation: false
            });
          }).catch((err) => log.error(err));
          return;
        }

      }
    }
    location = undefined;

    if (state.searchInProgress) {
      state.trigger('handleClearSearch');
    }

    state.set({
      selectedLocation: deselected ? null : _location,
      selectedGalaxy: deselected ? 0 : _location.galaxy,
      multiSelectedLocation: false
    });
  }
  toggleEdit = () => {
    this.setState({edit: !this.state.edit});
  }
  screenshotRefClick = () => {
    this.screenshotRef.click();
  }
  getScreenshotRef = (ref) => {
    this.screenshotRef = ref;
  }
  render() {
    let p = this.props;
    let {
      storedLocations,
      favorites,
      remoteLocations,
      remoteLocationsColumns,
      multiSelectedLocation,
      selectedLocation,
      selectedGalaxy,
      galaxyOptions,
      currentLocation,
      searchCache,
      sortStoredByKey,
      sortStoredByTime,
      filterOthers,
      showHidden,
      filterStoredByBase,
      filterStoredByScreenshot,
      useGAFormat,
      showOnlyBases,
      showOnlyCompatible,
      showOnlyDesc,
      showOnlyFriends,
      showOnlyGalaxy,
      showOnlyNames,
      showOnlyPC,
      showOnlyScreenshots,
      sortByDistance,
      sortByModded,
      username,
      profile,
      saveVersion,
      height,
      width,
      ps4User,
      configDir,
      mapLoading,
      map3d,
      mapDrawDistance,
      mapLines,
      show,
      navLoad
    } = p.s;

    let isOwnLocation = findIndex(storedLocations, (location) => location.id === (selectedLocation ? selectedLocation.id : null)) > -1;
    let remoteLocationsLoaded = remoteLocations && remoteLocations.results || searchCache.results.length > 0;

    let direction = sortStoredByKey === 'timeStamp' || sortStoredByKey === 'description' ? 'desc' : 'asc';
    let storedFavorites = [];
    let storedNonFavorites = [];

    each(storedLocations, (location) => {
      location.timeStamp = new Date(location.timeStamp).getTime();
      location.description = location.description ? location.description.trim() : '';
    });

    let storedSortFunction = (location) => {
      if (sortStoredByKey === 'name') {
        return location.name || useGAFormat ? location.translatedId : location.id;
      } else {
        return location[sortStoredByKey];
      }
    };

    if (filterOthers) {
      storedLocations = filter(storedLocations, (location) => {
        return location.username === username;
      });
    }
    if (!showHidden) {
      storedLocations = filter(storedLocations, (location) => {
        return !location.isHidden;
      });
    }
    if (filterStoredByBase) {
      storedLocations = filter(storedLocations, (location) => {
        return location.base && location.baseData;
      });
    }
    if (filterStoredByScreenshot) {
      storedLocations = filter(storedLocations, (location) => {
        return location.image;
      });
    }
    if (sortStoredByTime) {
      storedLocations = orderBy(storedLocations, storedSortFunction, direction);
    } else {
      storedFavorites = orderBy(
        filter(storedLocations, (location) => {
          return favorites.indexOf(location.id) > -1;
        }),
        sortStoredByKey,
        direction
      );
      storedNonFavorites = orderBy(
        filter(storedLocations, (location) => {
          return favorites.indexOf(location.id) === -1;
        }),
        sortStoredByKey,
        direction
      );
      storedLocations = storedFavorites.concat(storedNonFavorites);
    }

    let storedCurrentLocation = findIndex(storedLocations, (location) => location.id === currentLocation);
    if (storedCurrentLocation > -1) {
      let current = cloneDeep(storedLocations[storedCurrentLocation]);
      storedLocations.splice(storedCurrentLocation, 1);
      storedLocations = [current].concat(storedLocations);
    }

    let isSelectedLocationRemovable = false;
    if (p.s.selectedLocation) {
      let refLocation = findIndex(storedLocations, location => location.id === selectedLocation.id);
      isSelectedLocationRemovable = refLocation !== -1;
    }

    let locations = p.s.remoteLocations.results;
    if (showOnlyScreenshots) {
      locations = filter(locations, (location)=>{
        return location.image.length > 0;
      });
    }
    if (showOnlyNames) {
      locations = filter(locations, (location)=>{
        return location.data.name && location.data.name.length > 0;
      });
    }
    if (showOnlyDesc) {
      locations = filter(locations, (location)=>{
        return location.data.description && location.data.description.length > 0;
      });
    }
    if (showOnlyGalaxy) {
      locations = filter(locations, (location)=>{
        return location.data.galaxy === p.s.selectedGalaxy;
      });
    }
    if (showOnlyBases) {
      locations = filter(locations, (location)=>{
        return location.data.base;
      });
    }
    if (showOnlyCompatible && saveVersion) {
      locations = filter(locations, (location)=>{
        return location.version === saveVersion || location.data.version === saveVersion;
      });
    }
    if (showOnlyPC) {
      locations = filter(locations, (location)=>{
        return location.data.playerPosition && !location.data.manuallyEntered;
      });
    }
    if (showOnlyFriends) {
      locations = filter(locations, (location)=>{
        return (
          findIndex(profile.friends, (friend) => {
            return (location.profile && friend.username === location.profile.username) || friend.username === location.username;
          }) > -1
          || (location.profile && location.profile.username === profile.username)
        );
      });
    }
    if (sortByDistance || sortByModded) {
      locations = orderBy(locations, (location)=>{
        if (!location.data.mods) {
          location.data.mods = [];
        }
        if (sortByModded && sortByDistance) {
          return location.data.mods.length + location.data.distanceToCenter;
        } else if (sortByDistance) {
          return location.data.distanceToCenter;
        } else if (sortByModded) {
          return location.data.mods.length;
        }
      });
    }
    return (
      <div className="ui grid row Container__root">
        <input
        className="hide"
        ref={this.getScreenshotRef}
        onChange={this.handleUploadScreen}
        type="file"
        accept="image/*"
        multiple={false} />
        <div className="columns">
          <div className="ui segments stackable grid container Container__left">
            <StoredLocations
            onSelect={this.handleSelectLocation}
            storedLocations={storedLocations}
            selectedLocationId={selectedLocation ? selectedLocation.id : null}
            multiSelectedLocation={multiSelectedLocation}
            currentLocation={currentLocation}
            height={height}
            filterOthers={filterOthers}
            showHidden={showHidden}
            sortStoredByTime={sortStoredByTime}
            sortStoredByKey={sortStoredByKey}
            filterStoredByBase={filterStoredByBase}
            filterStoredByScreenshot={filterStoredByScreenshot}
            useGAFormat={useGAFormat}
            username={username} />
            <div className="ui segments Container__mapAndSelected">
              {remoteLocationsLoaded ?
              <GalacticMap
              mapLoading={mapLoading}
              map3d={map3d}
              mapDrawDistance={mapDrawDistance}
              mapLines={mapLines}
              galaxyOptions={galaxyOptions}
              selectedGalaxy={selectedGalaxy}
              storedLocations={storedLocations}
              width={width}
              height={height}
              remoteLocationsColumns={remoteLocationsColumns}
              remoteLocations={locations}
              selectedLocation={selectedLocation}
              currentLocation={currentLocation}
              username={p.s.username}
              show={show}
              onRestart={handleRestart}
              onSearch={p.onSearch}
              searchCache={searchCache.results}
              friends={profile ? profile.friends : empty} /> : null}
              {selectedLocation && !multiSelectedLocation ?
              <LocationBox
              name={selectedLocation.name}
              description={selectedLocation.description}
              username={username}
              selectType={true}
              currentLocation={currentLocation}
              isOwnLocation={isOwnLocation}
              isVisible={true}
              location={selectedLocation}
              navLoad={navLoad}
              updating={this.state.updating}
              edit={this.state.edit}
              favorites={favorites}
              image={selectedLocation.image}
              version={selectedLocation.version === saveVersion}
              width={width}
              height={height}
              isSelectedLocationRemovable={isSelectedLocationRemovable}
              onUploadScreen={this.screenshotRefClick}
              onDeleteScreen={this.handleDeleteScreen}
              onFav={this.handleFavorite}
              onEdit={this.toggleEdit}
              onMarkCompatible={this.handleCompatibility}
              onRemoveStoredLocation={p.onRemoveStoredLocation}
              onTeleport={p.onTeleport}
              onSubmit={this.handleUpdate}
              onSaveBase={p.onSaveBase}
              ps4User={ps4User}
              configDir={configDir} /> : null}
            </div>
          </div>
        </div>
        {remoteLocationsLoaded ?
        <RemoteLocations
        s={p.s}
        onSearch={p.onSearch}
        locations={locations}
        currentLocation={currentLocation}
        isOwnLocation={isOwnLocation}
        updating={this.state.updating}
        onPagination={p.onPagination}
        onTeleport={p.onTeleport}
        onFav={this.handleFavorite}
        onSaveBase={p.onSaveBase}
        ps4User={ps4User} /> : null}
      </div>
    );
  }
};

export default Container;