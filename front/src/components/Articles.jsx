import React, { useCallback, useEffect, useState } from 'react'
import { connect, useSelector, useDispatch } from 'react-redux'

import askGraphQL from '../helpers/graphQL'
import etv from '../helpers/eventTargetValue'

import Article from './Article'
import CreateArticle from './CreateArticle'

import styles from './articles.module.scss'
import buttonStyles from './button.module.scss'
import TagManagement from './TagManagement'
import ArticlesAccountSwitcher from './ArticlesAccountSwitcher'
import Button from './Button'
import Field from './Field'
import Loading from './Loading'
import { Search, Share2, SkipBack, Users } from 'react-feather'
import Tag from './Tag'
import Select from "./Select";

const mapStateToProps = ({ activeUser, sessionToken, applicationConfig }) => {
  return { activeUser, sessionToken, applicationConfig }
}

const ConnectedArticles = (props) => {
  const dispatch = useDispatch()

  const [isLoading, setIsLoading] = useState(true)
  const [showSwitchAccountSelect, setShowSwitchAccountSelect] = useState(false)
  const [filter, setFilter] = useState('')
  const [articles, setArticles] = useState([])
  const [tags, setTags] = useState([])
  const [filterTags, setFilterTags] = useState([])
  const [creatingArticle, setCreatingArticle] = useState(false)
  const [needReload, setNeedReload] = useState(true)
  const [tagManagement, setTagManagement] = useState(false)
  const [currentUser, setCurrentUser] = useState(props.activeUser)
  const [userAccounts, setUserAccounts] = useState([])
  const { displayName } = currentUser

  const currentUserId = useSelector(state => state.userPreferences.currentUser ?? state.activeUser._id)
  const setCurrentUserId = useCallback((userId) => dispatch({ type: 'USER_PREFERENCES_TOGGLE', key: 'currentUser', value: userId }), [])

  const handleReload = useCallback(() => setNeedReload(true), [])
  const handleUpdateTags = useCallback((articleId, tags) => {
    setArticles([...findAndUpdateArticleTags(articles, articleId, tags)])
  }, [articles])

  const handleCurrentUserChange = useCallback((selectedItem) => {
    console.log({selectedItem})
    setIsLoading(true)
    setCurrentUserId(selectedItem)
    setNeedReload(true)
  }, [currentUserId])

  const handleUpdateTitle = useCallback((articleId, title) => {
    // shallow copy otherwise React won't render the components again
    setArticles([...findAndUpdateArticleTitle(articles, articleId, title)])
  }, [articles])

  const handleCloseTag = useCallback(() => {
    setTagManagement(false)
  }, [])

  const findAndUpdateTag = (tags, id) => {
    const tag = tags.find((t) => t._id === id)
    tag.selected = !tag.selected
    return tags
  }

  const findAndUpdateArticleTags = (articles, articleId, tags) => {
    const article = articles.find((a) => a._id === articleId)
    article.tags = tags
    return articles
  }

  const findAndUpdateArticleTitle = (articles, articleId, title) => {
    const article = articles.find((a) => a._id === articleId)
    article.title = title
    return articles
  }

  const filterByTagsSelected = (article) => {
    const listOfTagsSelected = [...filterTags].filter((t) => t.selected)
    if (listOfTagsSelected.length === 0) {
      return true
    }
    let pass = true
    for (let i = 0; i < listOfTagsSelected.length; i++) {
      if (!article.tags.map((t) => t._id).includes(listOfTagsSelected[i]._id)) {
        pass = false
      }
    }
    return pass
  }

  const query = `query($user:ID!){
    user(user:$user){
      _id
      displayName
      tags {
        _id
        owner
        description
        color
        name
      }
    }

    articles(user:$user){
      _id
      title
      updatedAt

      owner {
        _id
        displayName
      }

      contributors {
        user {
          _id
          displayName
        }
      }

      versions{
        _id
        version
        revision
        message
      }

      tags{
        name
        owner
        color
        _id
      }
    }

    userGrantedAccess {
      _id
      displayName
    }
  }`

  useEffect(() => {
    const variables = { user: currentUserId }

    if (needReload) {
      //Self invoking async function
      (async () => {
      try {
          const data = await askGraphQL(
            { query, variables },
            'fetching articles',
            props.sessionToken,
            props.applicationConfig
          )

          setArticles(data.articles)

          const tags = data.user.tags.map((t) => ({
            ...t,
            selected: false,
            color: t.color || 'grey',
          }))
          setTags(tags)
          // deep copy of tags
          setCurrentUser(data.user)
          setUserAccounts([
            { _id: props.activeUser._id, displayName: props.activeUser.displayName },
            ...data.userGrantedAccess
          ])
          setFilterTags(structuredClone(tags))
          setIsLoading(false)
          setNeedReload(false)
        } catch (err) {
          alert(err)
        }
      })()
    }
  }, [needReload, currentUserId])

  return (
    <section className={styles.section}>
      <header className={styles.articlesHeader}>
        <h1>{articles.length} articles for</h1>
        <div className={styles.switchAccount}>
          <Users/>
          <Select className={[styles.accountSelect, buttonStyles.select].join(' ')} value={currentUserId} onChange={(e) => e.target.value && handleCurrentUserChange(e.target.value)}>
            {userAccounts.map((userAccount) => <option key={`userAccount_${userAccount._id}`} value={userAccount._id}>{userAccount.displayName}</option>)}
          </Select>
        </div>
      </header>
      <ul className={styles.horizontalMenu}>
        <li>
          <Button primary={true} onClick={() => setCreatingArticle(true)}>
            Create new Article
          </Button>
        </li>
        <li>
          <Button onClick={() => setTagManagement(!tagManagement)}>Manage tags</Button>
        </li>
      </ul>
      <TagManagement
        tags={tags}
        close={handleCloseTag}
        focus={tagManagement}
        articles={articles}
        setNeedReload={handleReload}
      />

      <div className={styles.actions}>
        {creatingArticle && (
          <CreateArticle
            tags={tags}
            cancel={() => setCreatingArticle(false)}
            triggerReload={() => {
              setCreatingArticle(false)
              setNeedReload(true)
            }}
          />
        )}
        <Field className={styles.searchField} type="text" icon={Search} value={filter} placeholder="Search"
                onChange={(e) => setFilter(etv(e))}/>
      </div>

      <aside className={styles.filtersContainer}>
        {tags.length > 0 && <div className={styles.filtersTags}>
          <h4>Filter by Tags</h4>
          <ul className={styles.filterByTags}>
            {filterTags.map((t) => (
              <li key={`filterTag-${t._id}`}>
                <Tag
                  tag={t}
                  activeUser={props.activeUser}
                  name={`filterTag-${t._id}`}
                  onClick={() => {
                    // shallow copy otherwise React won't render the components again
                    setFilterTags([...findAndUpdateTag(filterTags, t._id)])
                  }}
                />
              </li>
            ))}
          </ul>
        </div>}
      </aside>

      <hr className={styles.horizontalSeparator} />

      {isLoading ? <Loading /> : articles
        .filter(filterByTagsSelected)
        .filter(
          (a) => a.title.toLowerCase().indexOf(filter.toLowerCase()) > -1
        )
        .map((article) => (
          <Article
            key={`article-${article._id}`}
            masterTags={tags}
            article={article}
            setNeedReload={handleReload}
            updateTagsHandler={handleUpdateTags}
            updateTitleHandler={handleUpdateTitle}
          />
        ))}
    </section>
  )
}

const Articles = connect(mapStateToProps)(ConnectedArticles)
export default Articles
