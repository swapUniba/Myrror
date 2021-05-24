import {Injectable} from '@angular/core';
import {environment} from '../../environments/environment';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs/Observable';
import {isNullOrUndefined} from 'util';
import {AuthService} from './auth.service';

const API_LINK_ACCOUNT = 'api/instagram/link_account';
const API_USER_PROFILE = 'api/instagram/profile';
const API_USER_POSTS = 'api/instagram/posts';
const API_USER_FRIENDS = 'api/instagram/friends';
const API_DELETE_ACCOUNT = 'api/instagram/delete';
const API_CONFIG = 'api/instagram/config';

const NEXT_UPDATE_MILLIS = 1 * 60 * 1000;

@Injectable()
export class InstagramService {

  private url: string;

  // timeout variables
  private lastUpdateProfile: number;
  private lastUpdatePosts: number;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.url = environment.api;
    this.lastUpdateProfile = Date.now() - NEXT_UPDATE_MILLIS;
    this.lastUpdatePosts = Date.now() - NEXT_UPDATE_MILLIS;
  }

  /**
   * Link user profile.
   * @return{Observable<Object>}
   */
  linkAccount(username: string): Observable<any> {
    const postParams = {
      username: username,
      myrror_user: this.authService.getUserame()
    };
    return this.http.post(`${this.url}${API_LINK_ACCOUNT}`, postParams);
  }

  /**
   * Get user profile information.
   * @return{Observable<Object>}: Instagram user profile information if request was sent, false otherwise
   */
  profile(): Observable<any> {

    // timeout
    if (Date.now() - this.lastUpdateProfile >= NEXT_UPDATE_MILLIS) {
      this.lastUpdateProfile = Date.now();
      return this.http.get(`${this.url}${API_USER_PROFILE}`);
    } else {
      return Observable.of(false);
    }
  }

  /**
   * Get user posts.
   * @param messagesToRead: the number of messages to retrieve from database. If not specified, update the user messages
   *        with new ones
   * @return{Observable<Object>}: Instagram user posts if request was sent, false otherwise
   */
  userPosts(messagesToRead?: number): Observable<any> {

    // timeout
    if (messagesToRead || Date.now() - this.lastUpdatePosts >= NEXT_UPDATE_MILLIS) {

      // update the timeout only if user wants update posts
      if (!messagesToRead) {
        this.lastUpdatePosts = Date.now();
      }
      const postParams = {
        messages: messagesToRead,
      };
      return this.http.post(`${this.url}${API_USER_POSTS}`, postParams);
    } else {
      return Observable.of(false);
    }
  }

  /**
   * Get user friends (people tagged in posts).
   * @param friendsToRead the number of friends to retrieve from database. If not specified, update the user friends
   * @return {Observable<Object>}: Instagram user friends if request was sent, false otherwise
   */
  friends(friendsToRead?: number): Observable<any> {

      const postParams = {
        friendsNumber: friendsToRead,
      };
      return this.http.post(`${this.url}${API_USER_FRIENDS}`, postParams);

  }

  /**
   * Send Instagram configuration to update.
   * @param option: share options
   * @return {Observable<Object>}
   */
  configuration(option: {shareProfile?: boolean, shareMessages?: boolean}): Observable<any> {
    let params = '?';

    if (!isNullOrUndefined(option.shareProfile)) {
      params += 'shareProfile=' + option.shareProfile + '&';
    }

    if (!isNullOrUndefined(option.shareMessages)) {
      params += 'shareMessages=' + option.shareMessages + '&';
    }

    return this.http.get(`${this.url}${API_CONFIG}${params}`);
  }

  /**
   * Delete user Instagram account.
   * @return {Observable<Object>}
   */
  deleteAccount(): Observable<any> {
    return this.http.delete(`${this.url}${API_DELETE_ACCOUNT}`);
  }
}
