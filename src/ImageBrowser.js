import React from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native'
import * as ScreenOrientation from 'expo-screen-orientation';
import * as MediaLibrary from 'expo-media-library'
import * as Permissions from 'expo-permissions'
import ImageTile from './ImageTile'

const {width} = Dimensions.get('window');

export default class ImageBrowser extends React.Component {
  state = {
    hasCameraPermission: null,
    hasCameraRollPermission: null,
    numColumns: null,
    photos: [],
    selected: [],
    isEmpty: false,
    after: null,
    hasNextPage: true,
    loading: true,
  }

  async componentDidMount() {
    await this.getPermissionsAsync();
    ScreenOrientation.addOrientationChangeListener(this.onOrientationChange);
    const orientation = await ScreenOrientation.getOrientationAsync();
    const numColumns = this.getNumColumns(orientation);
    this.setState({numColumns});
    this.getPhotos();
  }

  getPermissionsAsync = async () => {
    const {status: camera} = await Permissions.askAsync(Permissions.CAMERA);
    const {status: cameraRoll} = await Permissions.askAsync(Permissions.CAMERA_ROLL);
    this.setState({
      hasCameraPermission: camera === 'granted',
      hasCameraRollPermission: cameraRoll === 'granted'
    });
  }

  onOrientationChange = ({orientationInfo}) => {
    ScreenOrientation.removeOrientationChangeListeners();
    ScreenOrientation.addOrientationChangeListener(this.onOrientationChange);
    const numColumns = this.getNumColumns(orientationInfo.orientation);
    this.setState({numColumns});
  }

  getNumColumns = orientation => orientation !== ScreenOrientation.Orientation.PORTRAIT_UP ? 4 : 7;

  selectImage = (index) => {
    let newSelected = Array.from(this.state.selected);
    if (newSelected.indexOf(index) === -1) {
      newSelected.push(index);
    } else {
      const deleteIndex = newSelected.indexOf(index);
      newSelected.splice(deleteIndex, 1);
    }
    if (newSelected.length > this.props.max) return;
    if (!newSelected) newSelected = [];
    this.setState({selected: newSelected});
    this.props.onChange(newSelected.length, () => this.prepareCallback());
  }

  getPhotos = () => {
    const params = {
      first: this.props.loadCount || 50,
      assetType: 'Photos',
      sortBy: ['creationTime']
    };
    if (this.state.after) params.after = this.state.after;
    if (!this.state.hasNextPage) return;
    MediaLibrary
      .getAssetsAsync(params)
      .then(this.processPhotos);
  }

  processPhotos = (data) => {
    if (data.totalCount) {
      if (this.state.after === data.endCursor) return;
      const uris = data.assets;
      this.setState({
        photos: [...this.state.photos, ...uris],
        after: data.endCursor,
        hasNextPage: data.hasNextPage
      });
      this.setState({loading: false});
    } else {
      this.setState({isEmpty: true});
    }
  }

  getItemLayout = (data, index) => {
    const length = width / 4;
    return {length, offset: length * index, index};
  }

  prepareCallback() {
    const { selected, photos } = this.state;
    const selectedPhotos = selected.map(i => photos[i]);
    const assetsInfo = Promise.all(selectedPhotos.map(i => MediaLibrary.getAssetInfoAsync(i)));
    this.props.callback(assetsInfo);
  }

  renderImageTile = ({item, index}) => {
    const selected = this.state.selected.indexOf(index) !== -1;
    const selectedItemNumber = this.state.selected.indexOf(index) + 1;
    return (
      <ImageTile
        selectedItemNumber={selectedItemNumber}
        item={item}
        index={index}
        selected={selected}
        selectImage={this.selectImage}
        renderSelectedComponent={this.props.renderSelectedComponent}
      />
    )
  }

  renderPreloader = () =>  this.props.preloaderComponent || <View style={styles.loadingScree}><ActivityIndicator size="large" style={{}}/></View> ;

  renderEmptyStay = () =>  this.props.emptyStayComponent || null;

  renderImages() {
    return (
      <View>
      <FlatList
        data={this.state.photos}
        numColumns={this.state.numColumns}
        key={this.state.numColumns}
        renderItem={this.renderImageTile}
        keyExtractor={(_, index) => index}
        onEndReached={() => {this.getPhotos()}}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={this.state.isEmpty ? this.renderEmptyStay() : null}
        initialNumToRender={24}
        getItemLayout={this.getItemLayout}
      />
      <Modal
      transparent={true}
      visible={this.state.loading}
      >
        {this.renderPreloader()}
      </Modal>
      </View>
    )
  }

  render() {
    const {hasCameraPermission} = this.state;

    if (!hasCameraPermission) {
      return this.props.noCameraPermissionComponent || null;
    }

    return (
      <View style={styles.container} >
        {this.renderImages()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScree: {
    flex: 1,
    justifyContent: 'center',
    alignContent: 'center',
  }
})
